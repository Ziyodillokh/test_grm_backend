import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payroll, PayrollStatus } from './payroll.entity';
import { Repository } from 'typeorm';
import { CreatePayrollDto, PaginationPayrollDto, UpdatePayrollDto } from './dto';
import { User } from '../user/user.entity';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import { PayrollItems } from '../payroll-items/payroll-items.entity';
import { CashFlowEnum, FilialTypeEnum, UserRoleEnum } from 'src/infra/shared/enum';
import { Report } from '../report/report.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import CashflowTipEnum from 'src/infra/shared/enum/cashflow/cashflow-tip.enum';

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(Payroll)
    private payrollRepo: Repository<Payroll>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PayrollItems)
    private payrollItemsRepo: Repository<PayrollItems>,
    @InjectRepository(Cashflow)
    private cashflowRepo: Repository<Cashflow>,

    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
  ) {}

  async create(dto: CreatePayrollDto): Promise<Payroll> {
    const queryRunner = this.payrollRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingPayroll = await this.payrollRepo.findOne({
        where: {
          month: dto.month,
        },
      });

      if (existingPayroll) {
        throw new BadRequestException(`${dto.month} oy uchun payroll allaqachon yaratilgan! ID: ${existingPayroll.id}`);
      }

      const plastic = dto.plastic ?? 0;
      const inHand = dto.inHand ?? 0;
      const bonus = dto.bonus ?? 0;
      const premium = dto.premium ?? 0;
      const year = new Date().getFullYear();
      // 1. Payroll yaratish
      const payroll = queryRunner.manager.create(Payroll, {
        ...dto,
        plastic,
        inHand,
        bonus,
        premium,
        total: plastic + inHand + premium + bonus, // vaqtincha
        award: 0,
        prepayment: 0,
        year,
      });

      const savedPayroll = await queryRunner.manager.save(Payroll, payroll);
      await queryRunner.commitTransaction();

      console.log(`Yangi payroll yaratildi: ${dto.month} ID: ${savedPayroll.id}`);

      return this.payrollRepo.findOne({ where: { id: savedPayroll.id } });
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Payroll yaratishda xatolik: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: PaginationPayrollDto) {
    const { page = 1, limit = 10 } = query;

    const queryBuilder = this.payrollRepo.createQueryBuilder('payroll');

    queryBuilder.orderBy('payroll.createdAt', 'DESC');

    const options: IPaginationOptions = {
      page,
      limit,
      route: '',
    };

    return paginate<Payroll>(queryBuilder, options);
  }

  async findOne(id: string) {
    return await this.payrollRepo.findOneBy({ id });
  }

  async getMonthlyPayroll(month: number, year: number): Promise<Payroll | null> {
    const data = await this.payrollRepo.findOne({
      where: {
        month: month,
        year: year,
      },
    });

    return data;
  }

  async update(id: string, dto: UpdatePayrollDto) {
    await this.payrollRepo.update(id, dto);
    return this.payrollRepo.findOne({ where: { id } });
  }

  async changeStatus(id: string) {
    const payroll = await this.payrollRepo.findOne({ where: { id } });
    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }
    const calculatedSum = (payroll.inHand ?? 0) + (payroll.plastic ?? 0);
    if (payroll.total > calculatedSum + 0.01) {
      throw new BadRequestException(
        `Total inHand va plastic yig'indisidan katta! Total: ${payroll.total}, In hand: ${payroll.inHand}, Plastic: ${payroll.plastic}, Yig'indi: ${calculatedSum}`,
      );
    }
    payroll.status = PayrollStatus.IN_PROGRESS;

    return await this.payrollRepo.save(payroll);
  }

  private getMonthName(month: number): string {
    const monthNames = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'Iyun',
      'Iyul',
      'Avgust',
      'Sentabr',
      'Oktabr',
      'Noyabr',
      'Dekabr',
    ];
    return monthNames[month - 1] || 'Unknown month';
  }

  async closePayroll(id: string, user: User) {
    const payroll = await this.payrollRepo.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    if (payroll.status !== PayrollStatus.IN_PROGRESS) throw new BadRequestException('HR hali Ведомость yubormagan');

    const userRole = user.position?.role;
    const filialReport = await this.reportRepo.findOne({
      where: {
        year: payroll.year,
        month: payroll.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });
    if (!filialReport) throw new NotFoundException('Filial report not found');
    let accountantUser = null;
    let mManagerUser = null;

    if (userRole === UserRoleEnum.ACCOUNTANT) {
      if ((filialReport.totalPlasticSum ?? 0) - (filialReport.totalCashCollection ?? 0) < (payroll.plastic ?? 0)) {
        throw new BadRequestException("Hisobinggizda yetarli mablag' yo'q");
      }
      payroll.isAccountantConfirmed = true;
      accountantUser = user;
    }

    if (userRole === UserRoleEnum.M_MANAGER) {
      if ((filialReport.managerSum ?? 0) < (payroll.inHand ?? 0)) {
        throw new BadRequestException("Hisobinggizda yetarli mablag' yo'q");
      }
      payroll.isMManagerConfirmed = true;
      mManagerUser = user;
    }

    if (payroll.isAccountantConfirmed && payroll.isMManagerConfirmed) {
      payroll.status = PayrollStatus.ACCEPTED;

      if (!accountantUser) {
        accountantUser = await this.userRepo.findOne({
          where: {
            position: { role: UserRoleEnum.ACCOUNTANT },
          },
        });
      }

      if (!mManagerUser) {
        mManagerUser = await this.userRepo.findOne({
          where: {
            position: { role: UserRoleEnum.M_MANAGER },
          },
        });
      }

      if (payroll.plastic && accountantUser) {
        await this.cashflowRepo.save(
          this.cashflowRepo.create({
            price: payroll.plastic,
            type: CashFlowEnum.Consumption,
            tip: CashflowTipEnum.CASHFLOW,
            comment: `Oylik ish haqqi: ${this.getMonthName(payroll.month)} oyi uchun ${payroll.year}`,
            cashflow_type: { id: '5ae9b4be-e9da-46b9-9e9c-20b97d462779' },
            date: new Date().toISOString(),
            report: filialReport,
            createdBy: accountantUser,
            is_online: true,
            is_static: true,
          }),
        );
      }

      if (payroll.inHand && mManagerUser) {
        await this.cashflowRepo.save(
          this.cashflowRepo.create({
            price: payroll.inHand,
            type: CashFlowEnum.Consumption,
            tip: CashflowTipEnum.CASHFLOW,
            comment: `Oylik ish haqqi: ${this.getMonthName(payroll.month)} oyi uchun ${payroll.year}`,
            cashflow_type: { id: '5ae9b4be-e9da-46b9-9e9c-20b97d462779' },
            date: new Date().toISOString(),
            report: filialReport,
            createdBy: mManagerUser,
            is_online: false,
            is_static: true,
          }),
        );
      }

      await this.updateReportOnPayrollClose(payroll);
    }

    return await this.payrollRepo.save(payroll);
  }

  async rejectPayroll(id: string) {
    const payroll = await this.payrollRepo.findOne({ where: { id } });
    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    if (payroll.status !== PayrollStatus.IN_PROGRESS) {
      throw new BadRequestException('Faqat IN_PROGRESS statusdagi payrollni rad etish mumkin');
    }

    payroll.status = PayrollStatus.REJECTED;
    payroll.isAccountantConfirmed = false;
    payroll.isMManagerConfirmed = false;

    return await this.payrollRepo.save(payroll);
  }

  async updateReportOnPayrollClose(payroll: Payroll) {
    const filialReport = await this.reportRepo.findOne({
      where: {
        year: payroll.year,
        month: payroll.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      console.log('Filial report not found for', payroll.year, payroll.month);
      return;
    }
    filialReport.managerSum -= payroll.inHand ?? 0;
    filialReport.accountantSum -= payroll.plastic ?? 0;

    await this.reportRepo.save(filialReport);
  }

  async remove(id: string) {
    return await this.payrollRepo.delete(id);
  }
}

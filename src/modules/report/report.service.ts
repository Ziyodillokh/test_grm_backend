import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { ReportQueryDto } from './dto';
import * as dayjs from 'dayjs';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { CashFlowEnum, FilialTypeEnum, OrderEnum } from '../../infra/shared/enum';
import KassaReportProgresEnum from '../../infra/shared/enum/kassa-report-progres.enum';
import { Report } from './report.entity';
import { Kassa } from '../kassa/kassa.entity';
import { CancelReportDto } from './dto/update-report.dto';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import ReportProgresEnum from 'src/infra/shared/enum/report-progres.enum';
import FilialType from '@infra/shared/enum/filial-type.enum';
import { PackageTransferEnum, UserRoleEnum } from '@infra/shared/enum';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { Order } from '@modules/order/order.entity';
import { Redis } from 'ioredis';
import { Product } from '@modules/product/product.entity';
import { Transfer } from '@modules/transfer/transfer.entity';
import { Media } from '@modules/media/media.entity';
import { PlanYearService } from '@modules/plan-year/plan-year.service';
import userRoleEnum from '@infra/shared/enum/user-role.enum';
import KassaProgresEnum from '@infra/shared/enum/kassa-progres-enum';
import CashflowTipEnum from '@infra/shared/enum/cashflow/cashflow-tip.enum';

@Injectable()
export class ReportService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly dataSource: DataSource,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Kassa)
    private readonly kassaRepo: Repository<Kassa>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(PackageTransfer)
    private readonly packageTransfer: Repository<PackageTransfer>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly entityManager: EntityManager,
    private readonly planYearService: PlanYearService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
  ) {
  }

  async paginateReports(options: IPaginationOptions): Promise<Pagination<Report>> {
    const queryBuilder = this.reportRepo.createQueryBuilder('report');
    queryBuilder.orderBy('report.year', 'DESC').addOrderBy('report.month', 'DESC');
    return paginate<Report>(queryBuilder, options);
  }

  async getCurrentReport(filial: Filial): Promise<Report> {
    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;

    // Filial tipiga mos report qidirish
    const filialType = filial?.type || FilialTypeEnum.FILIAL;

    let report = await this.reportRepo.findOne({
      where: { year, month, filialType },
    });

    if (!report) {
      report = this.reportRepo.create({ year, month, filialType });
      report = await this.reportRepo.save(report);
    }

    // Link unlinked kassas for current month (faqat shu filialType uchun)
    const orphanKassas = await this.kassaRepo
      .createQueryBuilder('kassa')
      .leftJoinAndSelect('kassa.filial', 'filial')
      .where('kassa.year = :year', { year })
      .andWhere('kassa.month = :month', { month })
      .andWhere('kassa."reportId" IS NULL')
      .andWhere('filial.type = :filialType', { filialType })
      .getMany();

    for (const kassa of orphanKassas) {
      kassa.report = report;
      await this.kassaRepo.save(kassa);
    }

    return this.reportRepo.findOne({
      where: { id: report.id },
      relations: ['kassas', 'kassas.filial'],
      order: { kassas: { filial: { title: 'ASC' } } },
    });
  }

  async getReportByDate(filial: Filial, { year, month }): Promise<Report> {
    const existing = await this.reportRepo.findOne({
      where: {
        year,
        month,
      },
    });

    if (existing) return existing;

    const newReport = this.reportRepo.create({
      year,
      month,
    });

    return await this.reportRepo.save(newReport);
  }

  async getReportsFiltered(query: ReportQueryDto, options: IPaginationOptions, user: User): Promise<Pagination<Report>> {
    const qb = this.reportRepo.createQueryBuilder('report');

    const roleToFilialTypeMap = {
      [UserRoleEnum.M_MANAGER]: FilialTypeEnum.FILIAL,
      [UserRoleEnum.D_MANAGER]: FilialTypeEnum.DEALER,
      [UserRoleEnum.I_MANAGER]: FilialTypeEnum.MARKET,
      [UserRoleEnum.ACCOUNTANT]: FilialTypeEnum.FILIAL,
    };

    if (user.position.role === UserRoleEnum.BOSS) {
      if (query.filialType) {
        qb.andWhere('report.filialType = :filialType', { filialType: query.filialType });
      } else {
        qb.andWhere('report.filialType = :filialType', { filialType: FilialTypeEnum.FILIAL });
      }
    } else {
      const filialType = roleToFilialTypeMap[user.position.role];
      if (filialType) {
        qb.andWhere('report.filialType = :filialType', { filialType });
      }
    }

    if (query.year) {
      qb.andWhere('report.year = :year', { year: query.year });
      let year = dayjs().year();
      const currentMonth = year === query.year ? dayjs().month() + 1 : 12;
      qb.andWhere('report.month <= :currentMonth', { currentMonth });
    }

    qb.orderBy('report.year', 'DESC').addOrderBy('report.month', 'DESC');

    const result = await paginate<Report>(qb, options);

    const { totalOwed } = await this.filialRepository
      .createQueryBuilder('filial')
      .select('COALESCE(SUM(filial.owed), 0)', 'totalOwed')
      .where('filial.type = :type', { type: FilialType.DEALER })
      .andWhere('filial.isActive = true')
      .getRawOne();

    return {
      ...result,
      items: result.items.map((report) => ({
        ...report,
        additionalProfitSum: Number(Number(report.totalAdditionalProfitSum ?? 0).toFixed(2)),
        netProfitSum: Number(Number(report.totalNetProfitSum ?? 0).toFixed(2)),
        totalSize: Number(Number(report.totalSaleSize ?? 0).toFixed(2)),
        totalPlasticSum: Number(Number(report.totalPlasticSum ?? 0).toFixed(2)),
        totalInternetShopSum: Number(Number(report.totalInternetShopSum ?? 0).toFixed(2)),
        totalSale: Number(Number(report.totalSale ?? 0).toFixed(2)),
        totalSaleReturn: Number(Number(report.totalSaleReturn ?? 0).toFixed(2)),
        totalCashCollection: Number(Number(report.totalCashCollection ?? 0).toFixed(2)),
        totalDiscount: Number(Number(report.totalDiscountSum ?? 0).toFixed(2)),
        totalIncome: Number(Number(report.totalIncome ?? 0).toFixed(2)),
        totalExpense: Number(Number(report.totalExpense ?? 0).toFixed(2)),
        managerSum: Number(Number(report.managerSum ?? 0).toFixed(2)),
        accountantSum: Number(Number(report.accountantSum ?? 0).toFixed(2)),
        owed: totalOwed,
      })),
    };
  }

  async getTotalReports(query: ReportQueryDto): Promise<{
    totalSellCount: number;
    additionalProfitSum: number;
    netProfitSum: number;
    totalSize: number;
    totalPlasticSum: number;
    totalInternetShopSum: number;
    totalSale: number;
    totalSaleReturn: number;
    totalCashCollection: number;
    totalDiscount: number;
    totalIncome: number;
    totalExpense: number;
    totalSum: number;
    managerSum: number;
    accountantSum: number;
    managerSaldo: number;
    accountantSaldo: number;
  }> {
    const qb = this.reportRepo.createQueryBuilder('report');

    if (query.year) {
      qb.andWhere('report.year = :year', { year: query.year });
      qb.andWhere('report.filialType = :type', { type: query.filialType || 'filial' });
    }

    const result = await qb
      .select('SUM(report.totalSaleCount)', 'totalSellCount')
      .addSelect('SUM(report.totalAdditionalProfitSum)', 'additionalProfitSum')
      .addSelect('SUM(report.totalNetProfitSum)', 'netProfitSum')
      .addSelect('SUM(report.totalSaleSize)', 'totalSize')
      .addSelect('SUM(report.totalPlasticSum)', 'totalPlasticSum')
      .addSelect('SUM(report.totalInternetShopSum)', 'totalInternetShopSum')
      .addSelect('SUM(report.totalSale)', 'totalSale')
      .addSelect('SUM(report.totalSaleReturn)', 'totalSaleReturn')
      .addSelect('SUM(report.totalCashCollection)', 'totalCashCollection')
      .addSelect('SUM(report.totalDiscountSum)', 'totalDiscount')
      .addSelect('SUM(report.totalIncome)', 'totalIncome')
      .addSelect('SUM(report.totalExpense)', 'totalExpense')
      .addSelect('SUM(report.managerSum)', 'managerSum')
      .addSelect('SUM(report.accountantSum)', 'accountantSum')
      .addSelect('SUM(report.managerSaldo)', 'managerSaldo')
      .addSelect('SUM(report.accountantSaldo)', 'accountantSaldo')
      .getRawOne();

    return {
      totalSellCount: parseInt(result?.totalSellCount || '0', 10),
      additionalProfitSum: parseFloat(result?.additionalProfitSum || '0'),
      netProfitSum: parseFloat(result?.netProfitSum || '0'),
      totalSize: parseFloat(result?.totalSize || '0'),
      totalPlasticSum: parseFloat(result?.totalPlasticSum || '0'),
      totalInternetShopSum: parseFloat(result?.totalInternetShopSum || '0'),
      totalSale: parseFloat(result?.totalSale || '0'),
      totalSaleReturn: parseFloat(result?.totalSaleReturn || '0'),
      totalCashCollection: parseFloat(result?.totalCashCollection || '0'),
      totalDiscount: parseFloat(result?.totalDiscountSum || '0'),
      totalIncome: parseFloat(result?.totalIncome || '0'),
      totalExpense: parseFloat(result?.totalExpense || '0'),
      totalSum: parseFloat(result?.totalSum || '0'),
      managerSum: parseFloat(result?.managerSum || '0'),
      accountantSum: parseFloat(result?.accountantSum || '0'),
      managerSaldo: parseFloat(result?.managerSaldo || '0'),
      accountantSaldo: parseFloat(result?.accountantSaldo || '0'),
    };
  }

  async changeValueByReport(filial: Filial, year: number, month: number): Promise<Report> {
    const kassas = await this.kassaRepo.find({
      where: { filial: { id: filial.id }, year, month },
    });

    const report = await this.getReportByDate(filial, { year, month });
    if (report.isCancelled) throw new BadRequestException('Report already cancelled');

    Object.assign(report, {
      totalSellCount: 0,
      totalSize: 0,
      totalSale: 0,
      totalCashCollection: 0,
      additionalProfitSum: 0,
      totalInternetShopSum: 0,
      totalDiscount: 0,
      totalPlasticSum: 0,
      netProfitSum: 0,
      totalSum: 0,
      totalExpense: 0,
      totalIncome: 0,
    });

    for (const k of kassas) {
      report.totalSaleCount += k.saleCount || 0;
      report.totalSaleSize += k.saleSize || 0;
      report.totalSale += k.sale || 0;
      report.totalCashCollection += k.cashCollection || 0;
      report.totalAdditionalProfitSum += k.additionalProfitSum || 0;
      report.totalInternetShopSum += k.internetShopSum || 0;
      report.totalDiscountSum += k.discountSum || 0;
      report.totalPlasticSum += k.plasticSum || 0;
      report.totalNetProfitSum += k.netProfitSum || 0;
      report.accountantSum += Math.max(k.plasticSum + k.cashCollection, 0);
      report.totalExpense += k.expense || 0;
      report.totalIncome += k.income || 0;
    }

    report.isCancelled = false;
    return this.reportRepo.save(report);
  }

  async cancelValueReport(dto: CancelReportDto, reportId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({ where: { id: dto.kassaReportId } });
    const report = await this.findOne(reportId);
    if (report.isCancelled) throw new BadRequestException('Report already cancelled');

    if (!kassa) {
      throw new BadRequestException('Kassa is not found');
    }

    Object.assign(report, {
      totalSellCount: report.totalSaleCount - (kassa.saleCount || 0),
      totalSize: report.totalSaleSize - (kassa.saleSize || 0),
      totalSale: report.totalSale - (kassa.sale || 0),
      totalCashCollection: Math.max(0, report.totalCashCollection - (kassa.cashCollection || 0)),
      additionalProfitSum: report.totalAdditionalProfitSum - (kassa.additionalProfitSum || 0),
      totalInternetShopSum: report.totalInternetShopSum - (kassa.internetShopSum || 0),
      totalDiscount: report.totalDiscountSum - (kassa.discountSum || 0),
      totalPlasticSum: report.totalPlasticSum - (kassa.plasticSum || 0),
      netProfitSum: report.totalNetProfitSum - (kassa.netProfitSum || 0),
      accountantSum: report.accountantSum - ((kassa.plasticSum + kassa.cashCollection) || 0),
      totalExpense: report.totalExpense - (kassa.expense || 0),
      totalIncome: report.totalIncome - (kassa.income || 0),
    });
    report.isCancelled = true;
    return this.reportRepo.save(report);
  }

  async closeReport(id: string, user: User) {
    const userRole = user.position?.role;

    const report = await this.reportRepo.findOne({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const check = {
      [userRoleEnum.ACCOUNTANT]: report.isAccountantConfirmed,
      [userRoleEnum.M_MANAGER]: report.isMManagerConfirmed,
    };

    if (report.filialType === FilialTypeEnum.DEALER && report.status !== ReportProgresEnum.CLOSED_BY_D) {
      throw new BadRequestException('Dealer reports must be closed by D_MANAGER before confirmation.');
    }

    if (userRole === userRoleEnum.ACCOUNTANT) {
      report.isAccountantConfirmed = true;
    } else if (userRole === userRoleEnum.M_MANAGER) {
      report.isMManagerConfirmed = true;
    }

    if (report.isAccountantConfirmed && report.isMManagerConfirmed) {
      report.status = ReportProgresEnum.ACCEPTED;

      // ──── Saldo: qoldiqlarni keyingi oyga o'tkazish ────
      const nextMonth = report.month === 12 ? 1 : report.month + 1;
      const nextYear = report.month === 12 ? report.year + 1 : report.year;

      const nextReport = await this.reportRepo.findOne({
        where: { month: nextMonth, year: nextYear, filialType: FilialTypeEnum.FILIAL },
      });

      if (nextReport) {
        const slugSaldo = await this.cashflowTypeRepository.findOne({
          where: { slug: 'balance' },
        });

        const users = await this.userRepository.find({
          where: [
            { position: { role: 9 }, isActive: true },
            { position: { role: 10 }, isActive: true },
          ],
          relations: { position: true },
        });

        for (const u of users) {
          const amount = u.position.role === 9 ? report.managerSum : report.accountantSum;

          if (amount > 0 && slugSaldo) {
            await this.cashflowRepository.save(
              this.cashflowRepository.create({
                price: amount,
                type: CashFlowEnum.InCome,
                tip: CashflowTipEnum.CASHFLOW,
                comment: `${report.month}-oy saldo qoldig'i ${report.year}`,
                cashflow_type: slugSaldo,
                date: new Date().toISOString(),
                report: nextReport,
                createdBy: u,
                is_online: false,
                is_static: true,
              }),
            );

            if (u.position.role === 9) {
              nextReport.managerSum += amount;
              nextReport.managerSaldo = amount;
            } else {
              nextReport.accountantSum += amount;
              nextReport.accountantSaldo = amount;
            }
            nextReport.totalIncome += amount;
          }
        }

        await this.reportRepo.save(nextReport);
      }
    }

    return await this.reportRepo.save(report);
  }

  async testcreate() {
    const report = this.reportRepo.create({ year: 2025, month: 6 });
    return await this.reportRepo.save(report);
  }

  async findOne(id: string) {
    const report = await this.reportRepo.findOne({
      where: {
        id,
      },
      relations: ['kassas', 'kassas.filial', 'kassas.filial.manager'],
      order: {
        kassas: { filial: { title: 'ASC' } },
      },
    });


    if (!report) {
      throw new NotFoundException('Report not found!');
    }

    const { totalOwed } = await this.filialRepository
      .createQueryBuilder('filial')
      .select('COALESCE(SUM(filial.owed), 0)', 'totalOwed')
      .where('filial.type = :type', { type: FilialType.DEALER })
      .andWhere('filial.isActive = true')
      .getRawOne();


    report['owed'] = totalOwed;

    return report;
  }

  async findOneByFilialTypes(id: string) {
    const report = await this.reportRepo.findOne({
      where: {
        id,
        kassas: {
          filial: {
            type: Not(FilialTypeEnum.WAREHOUSE),
          },
        },
      },
      relations: ['kassas', 'kassas.filial'],
    });

    if (!report) {
      throw new NotFoundException('Report not found or filial is not of type FILIAL');
    }

    return report;
  }




  async generateReportsByYear(): Promise<Report[]> {
    const year = new Date().getFullYear();
    const currentMonth = dayjs().month() + 1;

    const targetTypes: FilialTypeEnum[] = [FilialTypeEnum.FILIAL, FilialTypeEnum.DEALER, FilialTypeEnum.MARKET];

    const createdOrUpdatedReports: Report[] = [];

    for (const type of targetTypes) {
      for (let month = 1; month <= 12; month++) {
        let report = await this.reportRepo.findOne({
          where: {
            year,
            month,
            filialType: type,
          },
        });
        let reportStatus: number;
        if (month < currentMonth) {
          reportStatus = 1;
        } else if (month === currentMonth) {
          reportStatus = 2;
        } else {
          reportStatus = 3;
        }

        if (report) {
          report.reportStatus = reportStatus;
        } else {
          report = this.reportRepo.create({
            year,
            month,
            reportStatus,
            filialType: type,
          });
        }

        const saved = await this.reportRepo.save(report);
        createdOrUpdatedReports.push(saved);
      }
    }

    return createdOrUpdatedReports;
  }

  async generateReportsByYearNew(targetYear: number): Promise<Report[]> {
    const now = dayjs();

    const currentYear = now.year();
    const currentMonth = now.month() + 1;

    const targetTypes: FilialTypeEnum[] = [
      FilialTypeEnum.FILIAL,
      FilialTypeEnum.DEALER,
      FilialTypeEnum.MARKET,
    ];

    const createdOrUpdatedReports: Report[] = [];

    for (const type of targetTypes) {
      for (let month = 1; month <= 12; month++) {
        let report = await this.reportRepo.findOne({
          where: {
            year: targetYear,
            month,
            filialType: type,
          },
        });

        let reportStatus: number;

        if (targetYear < currentYear) {
          reportStatus = 1;
        } else if (targetYear > currentYear) {
          reportStatus = 3;
        } else {
          if (month < currentMonth) {
            reportStatus = 1;
          } else if (month === currentMonth) {
            reportStatus = 2;
          } else {
            reportStatus = 3;
          }
        }

        if (report) {
          report.reportStatus = reportStatus;
        } else {
          report = this.reportRepo.create({
            year: targetYear,
            month,
            reportStatus,
            filialType: type,
          });
        }

        const saved = await this.reportRepo.save(report);
        createdOrUpdatedReports.push(saved);
      }
    }

    return createdOrUpdatedReports;
  }


  // Links the kassa to the report
  async generateAndLinkReportsByYear(): Promise<Report[]> {
    const createdOrUpdatedReports = await this.generateReportsByYear();

    for (const report of createdOrUpdatedReports) {
      const kassas = await this.kassaRepo.find({
        where: {
          year: report.year,
          month: report.month,
          filialType: report.filialType,
        },
        relations: ['report'],
      });

      for (const kassa of kassas) {
        kassa.report = report;
        await this.kassaRepo.save(kassa);
      }
    }
    return createdOrUpdatedReports;
  }

  // for created new kassa
  async getOrCreateKassaForFilial(filialId: string, year: number, month: number): Promise<Kassa> {
    const currentMonth = dayjs().month() + 1;

    let kassaStatus: number;
    if (month < currentMonth) {
      kassaStatus = 1;
    } else if (month === currentMonth) {
      kassaStatus = 2;
    } else {
      kassaStatus = 3;
    }

    // Filial tipiga qarab to'g'ri reportni topish
    const filial = await this.filialRepository.findOne({ where: { id: filialId } });
    const filialType = filial?.type || FilialTypeEnum.FILIAL;

    let report = await this.reportRepo.findOne({
      where: { year, month, filialType },
    });

    if (!report) {
      report = this.reportRepo.create({
        year,
        month,
        reportStatus: kassaStatus,
        filialType,
      });
      report = await this.reportRepo.save(report);
    } else {
      if (!report.reportStatus || report.reportStatus !== kassaStatus) {
        report.reportStatus = kassaStatus;
        report = await this.reportRepo.save(report);
      }
    }

    let kassa = await this.kassaRepo.findOne({
      where: {
        filial: { id: filialId },
        year,
        month,
      },
      relations: ['report'],
    });

    if (kassa) {
      kassa.kassaStatus = kassaStatus;
      kassa.report = report;
    } else {
      kassa = this.kassaRepo.create({
        filial: { id: filialId },
        year,
        month,
        kassaStatus,
        report,
      });
    }

    return this.kassaRepo.save(kassa);
  }

  async aggregateAndSaveReport(year: number, month: number): Promise<Report[]> {
    return await this.entityManager.transaction(async (manager) => {
      const reports: Report[] = [];
      const usedFilialTypes = [FilialTypeEnum.FILIAL, FilialTypeEnum.DEALER, FilialTypeEnum.MARKET];

      // Transaction ichidagi repositorylar
      const reportRepo = manager.getRepository(Report);
      const kassaRepository = manager.getRepository(Kassa);
      const cashflowRepository = manager.getRepository(Cashflow);

      for (const type of usedFilialTypes) {
        // DEALER alohida mantiq
        if (type === FilialTypeEnum.DEALER) {
          const dealerReport = await reportRepo.findOne({
            where: { year, month, filialType: type },
          });

          if (dealerReport) {
            reports.push(dealerReport);
          }
          continue;
        }

        // 1-BOSQICH: Kassa yig'ish
        const kassas = await kassaRepository.find({
          where: {
            year,
            month,
            status: KassaProgresEnum.ACCEPTED,
            filialType: type,
          },
        });

        const kassaAggregated = {
          totalSaleCount: 0,
          totalAdditionalProfitSum: 0,
          totalNetProfitSum: 0,
          totalSaleSize: 0,
          totalPlasticSum: 0,
          totalInternetShopSum: 0,
          totalSale: 0,
          totalSaleReturn: 0,
          totalCashCollection: 0,
          totalDiscountSum: 0,
          totalIncome: 0,
          totalExpense: 0,
          managerSum: 0,
          accountantSum: 0,
        };

        // Har bir kassani alohida logga yozish
        for (const k of kassas) {

          kassaAggregated.totalSaleCount += k.saleCount || 0;
          kassaAggregated.totalAdditionalProfitSum += k.additionalProfitSum || 0;
          kassaAggregated.totalNetProfitSum += k.netProfitSum || 0;
          kassaAggregated.totalSaleSize += k.saleSize || 0;
          kassaAggregated.totalPlasticSum += k.plasticSum || 0;
          kassaAggregated.totalInternetShopSum += k.internetShopSum || 0;
          kassaAggregated.totalSale += k.sale || 0;
          kassaAggregated.totalSaleReturn += k.saleReturn || 0;
          kassaAggregated.totalCashCollection += k.cashCollection || 0;
          kassaAggregated.totalDiscountSum += k.discountSum || 0;
          kassaAggregated.totalIncome += k.income || 0;
          kassaAggregated.totalExpense += k.expense || 0;
          kassaAggregated.accountantSum += (k.plasticSum + k.cashCollection) || 0;
        }

        let report = await reportRepo.findOne({
          where: { year, month, filialType: type },
        });

        if (!report) {
          report = reportRepo.create({
            year,
            month,
            filialType: type,
            ...kassaAggregated,
            reportStatus: 1,
            isCancelled: false,
            accountantSum: 0,
            managerSum: 0,
          });
        } else {
          Object.assign(report, kassaAggregated);
        }

        await reportRepo.save(report);

        if (type === FilialTypeEnum.FILIAL) {
          const dealerReports = await reportRepo.find({
            where: {
              year,
              month,
              filialType: FilialTypeEnum.DEALER,
              status: ReportProgresEnum.ACCEPTED,
            },
          });

          // DEALER qo'shishdan oldingi holat
          const beforeDealers = {
            totalIncome: report.totalIncome,
            totalExpense: report.totalExpense,
          };

          for (const dealerReport of dealerReports) {

            await this.addDealerToFilialReport(dealerReport, manager);
          }

          if (dealerReports.length > 0) {
            report = await reportRepo.findOne({ where: { id: report.id } });
          }
        }

        // Income cashflowlarni yig'ish
        const incomeFlows = await cashflowRepository.find({
          where: {
            report: { id: report.id },
            type: CashFlowEnum.InCome,
            is_static: false,
          },
          relations: ['cashflow_type', 'createdBy', 'createdBy.position'],
          order: { date: 'ASC' },
        });

        // Income qo'shishdan oldingi holat
        const beforeIncome = {
          totalIncome: report.totalIncome,
          accountantSum: report.accountantSum,
          managerSum: report.managerSum,
        };

        let incomeAccountantTotal = 0;
        let incomeManagerTotal = 0;

        for (const cashflow of incomeFlows) {
          const user = cashflow.createdBy;
          if (!user || !user.position) {
            console.log(`    SKIP: Cashflow ID ${cashflow.id} - user yoki position yo'q`);
            continue;
          }

          const price = Math.abs(cashflow.price || 0);
          const isAccountant = user.position.role === UserRoleEnum.ACCOUNTANT;

          console.log(`    INCOME CASHFLOW:`, {
            id: cashflow.id,
            price: price,
            user: user.firstName || user.id,
            role: isAccountant ? 'ACCOUNTANT' : 'MANAGER',
            date: cashflow.date,
          });

          if (isAccountant) {
            report.accountantSum += price;
            report.totalIncome += price;
            incomeAccountantTotal += price;
          } else {
            report.totalIncome += price;
            report.managerSum += price;
            incomeManagerTotal += price;
          }
        }

        await reportRepo.save(report);
        console.log(`  3-BOSQICH TUGADI - PRIXODLAR QOSHILDI:`);
        console.log(`     Oldingi holat:`, beforeIncome);
        console.log(`     Qo'shilgan ACCOUNTANT prixodlar: ${incomeAccountantTotal}`);
        console.log(`     Qo'shilgan MANAGER prixodlar: ${incomeManagerTotal}`);
        console.log(
          `     Keyingi holat: totalIncome=${report.totalIncome}, accountantSum=${report.accountantSum}, managerSum=${report.managerSum}`,
        );

        // Expense cashflowlarni yig'ish
        console.log(`\n 4-BOSQICH: Expense cashflowlar yig'ilmoqda...`);
        const expenseCashflows = await cashflowRepository.find({
          where: {
            report: { id: report.id },
            type: CashFlowEnum.Consumption,
          },
          relations: ['cashflow_type', 'createdBy', 'createdBy.position'],
          order: { date: 'ASC' },
        });
        console.log(`  ${expenseCashflows.length} ta expense cashflow topildi`);

        // Expense qo'shishdan oldingi holat
        const beforeExpense = {
          totalExpense: report.totalExpense,
          accountantSum: report.accountantSum,
          managerSum: report.managerSum,
        };

        let expenseAccountantTotal = 0;
        let expenseManagerTotal = 0;

        for (const cashflow of expenseCashflows) {
          const user = cashflow.createdBy;
          if (!user || !user.position) {
            console.log(`    SKIP: Cashflow ID ${cashflow.id} - user yoki position yo'q`);
            continue;
          }

          const price = Math.abs(cashflow.price || 0);
          const isAccountant = user.position.role === UserRoleEnum.ACCOUNTANT;

          console.log(`    EXPENSE CASHFLOW:`, {
            id: cashflow.id,
            price: price,
            user: user.firstName || user.id,
            role: isAccountant ? 'ACCOUNTANT' : 'MANAGER',
            date: cashflow.date,
          });

          if (isAccountant) {
            if (report.accountantSum < price) {
              console.error(`ACCOUNTANT balans yetarli emas: kerak=${price}, bor=${report.accountantSum}`);
              throw new BadRequestException('Hisobingizda mablag\' yetarli emas');
            }
            report.accountantSum -= price;
            report.totalExpense += price;
            expenseAccountantTotal += price;
            console.log(`    ACCOUNTANT dan ${price} ayirildi. Qolgan: ${report.accountantSum}`);
          } else {
            if (report.managerSum < price) {
              console.error(`MANAGER balans yetarli emas: kerak=${price}, bor=${report.managerSum}`);
              throw new BadRequestException('Hisobingizda mablag\' yetarli emas');
            }
            report.managerSum -= price;
            expenseManagerTotal += price;
            report.totalExpense += price;
            console.log(`    MANAGER dan ${price} ayirildi. Qolgan: ${report.managerSum}`);
          }
        }

        await reportRepo.save(report);
        console.log(`  4-BOSQICH TUGADI - RASXODLAR AYIRILDI:`);
        console.log(`     Oldingi holat:`, beforeExpense);
        console.log(`     Ayirilgan ACCOUNTANT rasxodlar: ${expenseAccountantTotal}`);
        console.log(`     Ayirilgan MANAGER rasxodlar: ${expenseManagerTotal}`);
        console.log(
          `     Keyingi holat: totalExpense=${report.totalExpense}, accountantSum=${report.accountantSum}, managerSum=${report.managerSum}`,
        );

        // YAKUNIY REPORT HOLATI
        console.log(`\n ${type} UCHUN YAKUNIY REPORT HOLATI:`);
        console.log(`   Report ID: ${report.id}`);
        console.log(`   totalIncome: ${report.totalIncome}`);
        console.log(`   totalExpense: ${report.totalExpense}`);
        console.log(`   accountantSum: ${report.accountantSum}`);
        console.log(`   managerSum: ${report.managerSum}`);
        console.log(`   Umumiy balans: accountantSum + managerSum = ${report.accountantSum + report.managerSum}`);

        reports.push(report);
      }

      console.log(`\n=== ${reports.length} ta report tayyor bo'ldi ===`);
      return reports;
    });
  }

  async createReportsForYear(): Promise<void> {
    const year = new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
      await this.aggregateAndSaveReport(year, month);
    }
  }

  async saveReport(report: Report): Promise<Report> {
    return this.reportRepo.save(report);
  }

  async deleteReport(id: string): Promise<void> {
    const result = await this.reportRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Report not found');
    }
  }

  async findAllByYearMonthAndFilialType(year: number, month: number, filialType: FilialTypeEnum): Promise<Report[]> {
    return this.reportRepo.find({
      where: {
        year,
        month,
        filialType,
      },
      relations: ['filial'],
    });
  }

  async findOneByYearMonthAndFilialType(
    year: number,
    month: number,
    filialType: FilialTypeEnum,
  ): Promise<Report> {
    return this.reportRepo.findOne({
      where: { year, month, filialType },
    });
  }

  async closeDealerReport(id: string, user: User) {
    const userRole = user.position?.role;

    const report = await this.reportRepo.findOne({
      where: { id },
      relations: { filial: true, kassas: true },
    });

    if (!report) throw new BadRequestException('Report not found');

    if (report.filialType !== FilialTypeEnum.DEALER) {
      throw new BadRequestException('This action is allowed only for DEALER filial type!');
    }

    if (report.status === ReportProgresEnum.ACCEPTED) {
      throw new BadRequestException('Report already accepted!');
    }

    if (report.status !== ReportProgresEnum.CLOSED_BY_D && userRole !== UserRoleEnum.D_MANAGER) {
      throw new BadRequestException('Report must be closed by D_MANAGER first!');
    }

    // Kassalarni tekshirish
    const openKassas = report.kassas.filter((kassa) => kassa.status === KassaProgresEnum.OPEN || kassa.status === KassaProgresEnum.WARNING);

    if (openKassas.length > 0) {
      throw new BadRequestException('You have unclosed kassa reports');
    }

    // D_MANAGER faqat bir marta CLOSED_BY_D qiladi
    if (userRole === UserRoleEnum.D_MANAGER) {
      if (report.status === ReportProgresEnum.CLOSED_BY_D) {
        throw new BadRequestException('Report already closed by D_MANAGER!');
      }
      report.status = ReportProgresEnum.CLOSED_BY_D;
    }

    // M_MANAGER tasdiqlaydi
    if (userRole === UserRoleEnum.M_MANAGER) {
      if (report.isMManagerConfirmed) {
        throw new BadRequestException('Report already confirmed by M_MANAGER!');
      }

      await this.reportRepo.update({ id: report.id }, { isMManagerConfirmed: true });
    }

    // ACCOUNTANT tasdiqlaydi
    if (userRole === UserRoleEnum.ACCOUNTANT) {
      if (report.isAccountantConfirmed) {
        throw new BadRequestException('Report already confirmed by ACCOUNTANT!');
      }
      await this.reportRepo.update({ id: report.id }, { isAccountantConfirmed: true });
    }

    // Ikkala tasdiq bo'lsa — status ACCEPTED va qo'shiladi
    const shouldAccept = report.isMManagerConfirmed && report.isAccountantConfirmed;
    if (shouldAccept && (report.status as ReportProgresEnum) !== ReportProgresEnum.ACCEPTED) {
      report.status = ReportProgresEnum.ACCEPTED;

      const { totalOwed } = await this.filialRepository
        .createQueryBuilder('filial')
        .select('COALESCE(SUM(filial.owed), 0)', 'totalOwed')
        .where('filial.type = :type', { type: FilialType.DEALER })
        .andWhere('filial.isActive = true')
        .getRawOne();

      report.totalFrozenOwed = totalOwed;

      // await this.moveToNextMonthDealerReport(report);
    }

    return await this.reportRepo.save(report);
  }

  async addDealerToFilialReportForManager(dealerReport: Report, manager?: EntityManager) {
    if (dealerReport.filialType !== FilialTypeEnum.DEALER) {
      return;
    }

    const reportRepo = manager ? manager.getRepository(Report) : this.reportRepo;

    const filialReport = await reportRepo.findOne({
      where: {
        year: dealerReport.year,
        month: dealerReport.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      return;
    }

    filialReport.managerSum += dealerReport.totalIncome ?? 0;
    filialReport.managerSum -= dealerReport.totalPlasticSum ?? 0;

    await reportRepo.save(filialReport);
  }

  async addDealerToFilialReport(dealerReport: Report, manager?: EntityManager) {
    if (dealerReport.filialType !== FilialTypeEnum.DEALER) {
      return;
    }

    const reportRepo = manager ? manager.getRepository(Report) : this.reportRepo;

    const filialReport = await reportRepo.findOne({
      where: {
        year: dealerReport.year,
        month: dealerReport.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      return;
    }

    filialReport.totalPlasticSum += dealerReport.totalPlasticSum ?? 0;
    filialReport.accountantSum += dealerReport.totalPlasticSum ?? 0;
    filialReport.managerSum += dealerReport.totalIncome ?? 0;
    filialReport.managerSum -= dealerReport.totalPlasticSum ?? 0;

    // Dealer debt fieldlarni FILIAL reportga qo'shish
    filialReport.totalDebtCount += dealerReport.totalDebtCount ?? 0;
    filialReport.totalDebtSize += dealerReport.totalDebtSize ?? 0;
    filialReport.totalDebtSum += dealerReport.totalDebtSum ?? 0;
    filialReport.totalDebtProfitSum += dealerReport.totalDebtProfitSum ?? 0;
    filialReport.totalDiscountSum += dealerReport.totalDiscountSum ?? 0;

    await reportRepo.save(filialReport);
  }

  async addDealerToFilialReportForAccauntant(dealerReport: Report, manager?: EntityManager) {
    if (dealerReport.filialType !== FilialTypeEnum.DEALER) {
      return;
    }

    const reportRepo = manager ? manager.getRepository(Report) : this.reportRepo;

    const filialReport = await reportRepo.findOne({
      where: {
        year: dealerReport.year,
        month: dealerReport.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      return;
    }

    filialReport.totalPlasticSum += dealerReport.totalPlasticSum ?? 0;
    filialReport.accountantSum += dealerReport.totalPlasticSum ?? 0;

    await reportRepo.save(filialReport);
  }

  async getDealerClosedByDReports(year: number, month: number) {
    return this.reportRepo.find({
      where: {
        year,
        month,
        filialType: FilialTypeEnum.DEALER
      },
      relations: { filial: {manager: true} },
    });
  }

  async moveToNextMonthDealerReport(currentReport: Report) {
    if (currentReport.filialType !== FilialTypeEnum.DEALER) return;

    const currentMonth = dayjs()
      .month(currentReport.month - 1)
      .year(currentReport.year);

    const nextMonth = currentMonth.add(1, 'month');

    const nextMonthReport = await this.reportRepo.findOne({
      where: {
        filialType: FilialTypeEnum.DEALER,
        month: nextMonth.month() + 1,
        year: nextMonth.year(),
      },
    });

    if (!nextMonthReport) return;

    const nextKassas = await this.kassaRepo.find({
      where: {
        report: { id: nextMonthReport.id },
      },
      relations: ['filial'],
    });

    for (const nextKassa of nextKassas) {
      const previousKassa = await this.kassaRepo.findOne({
        where: {
          filial: { id: nextKassa.filial.id },
          month: currentMonth.month() + 1,
          year: currentMonth.year(),
        },
      });

      if (previousKassa) {
        nextKassa.expense += previousKassa.expense ?? 0;
        await this.kassaRepo.save(nextKassa);
      }
    }
  }

  async deleteOne(id: string): Promise<void> {
    const result = await this.reportRepo.softDelete(id);
    if (result.affected === 0) {
      throw new BadRequestException('Report not found');
    }
  }

  async restoreOne(id: string): Promise<void> {
    const result = await this.reportRepo.restore(id);
    if (result.affected === 0) {
      throw new BadRequestException('Report not found');
    }
  }

  async aggregateKassa(year: number, month: number, kassaId: string): Promise<void> {
    const report = await this.reportRepo.findOne({
      where: {
        year: year,
        month: month,
        filialType: FilialTypeEnum.DEALER,
      },
    });

    if (!report) {
      throw new BadRequestException(`${year} yil ${month} oy uchun DEALER tipi reporti topilmadi`);
    }

    const kassa = await this.kassaRepo.findOne({
      where: {
        id: kassaId,
        year: year,
        month: month,
        filialType: FilialTypeEnum.DEALER,
        status: KassaProgresEnum.ACCEPTED,
      },
    });

    if (!kassa) {
      throw new BadRequestException('Kassa topilmadi yoki u ACCEPTED holatda emas');
    }

    report.totalPlasticSum += kassa.plasticSum || 0;
    report.totalExpense += kassa.expense || 0;
    report.totalIncome += kassa.income || 0;

    await this.reportRepo.save(report);
  }

  async addManagerSum(kassaId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({
      where: { id: kassaId },
    });

    if (!kassa) {
      throw new NotFoundException('Kassa topilmadi');
    }

    let report = await this.reportRepo.findOne({
      where: {
        year: kassa.year,
        month: kassa.month,
        filialType: kassa.filialType,
      },
    });

    report.totalIncome += kassa.income || 0;

    await this.reportRepo.save(report);
    console.log(`  Report saqlandi`);

    return report;
  }

  async addAccauntantSum(kassaId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({
      where: { id: kassaId },
    });

    if (!kassa) {
      throw new NotFoundException('Kassa topilmadi');
    }

    let report = await this.reportRepo.findOne({
      where: {
        year: kassa.year,
        month: kassa.month,
        filialType: kassa.filialType,
      },
    });

    report.accountantSum += (kassa.plasticSum + kassa.cashCollection) || 0;
    report.totalPlasticSum += kassa.plasticSum || 0;
    report.totalCashCollection += kassa.cashCollection || 0;

    await this.reportRepo.save(report);
    console.log(`  Report saqlandi`);

    return report;
  }

  async addOtherSum(kassaId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({
      where: { id: kassaId },
    });

    if (!kassa) {
      throw new NotFoundException('Kassa topilmadi');
    }

    let report = await this.reportRepo.findOne({
      where: {
        year: kassa.year,
        month: kassa.month,
        filialType: kassa.filialType,
      },
    });
    if (!report) {
      throw new NotFoundException('Ushbu yil va oy uchun report topilmadi');
    }
    report.totalSaleCount += kassa.saleCount || 0;
    report.totalAdditionalProfitSum += kassa.additionalProfitSum || 0;
    report.totalNetProfitSum += kassa.netProfitSum || 0;
    report.totalSaleSize += kassa.saleSize || 0;
    report.totalInternetShopSum += kassa.internetShopSum || 0;
    report.totalSale += kassa.sale || 0;
    report.totalSaleReturn += kassa.saleReturn || 0;
    report.totalDiscountSum += kassa.discountSum || 0;
    report.totalExpense += kassa.expense || 0;

    await this.reportRepo.save(report);

    await this.kassaRepo.save(kassa);

    return report;
  }

  async save(report: Report): Promise<Report> {
    return this.reportRepo.save(report);
  }

  async changeStatusByMonth() {
    const now = dayjs();
    const nextMonth = now.add(1, 'month');
    const month = nextMonth.month() + 1;
    const year = nextMonth.year();

    const currentMonth = now.month() + 1;
    const currentYear = now.year();

    const targetTypes: FilialTypeEnum[] = [FilialTypeEnum.FILIAL, FilialTypeEnum.DEALER, FilialTypeEnum.MARKET];

    // 1. Joriy oy OPEN reportlarni WARNING ga o'zgartirish (oy tugayapti)
    const currentReports = await this.reportRepo.find({
      where: {
        month: currentMonth,
        year: currentYear,
        status: ReportProgresEnum.OPEN,
      },
    });

    for (const report of currentReports) {
      report.status = ReportProgresEnum.WARNING;
      report.reportStatus = 1; // o'tgan oy
      await this.reportRepo.save(report);
    }

    // 2. Yangi oy uchun reportlar yaratish yoki mavjudlarini OPEN qilish
    for (const type of targetTypes) {
      let report = await this.reportRepo.findOne({
        where: { year, month, filialType: type },
      });

      if (!report) {
        report = this.reportRepo.create({
          year,
          month,
          filialType: type,
          status: ReportProgresEnum.OPEN,
          reportStatus: 2, // joriy oy
        });
        await this.reportRepo.save(report);
      } else if (report.status === ReportProgresEnum.OPEN) {
        report.reportStatus = 2;
        await this.reportRepo.save(report);
      }
    }
  }

  async update(id: string, data) {
    await this.reportRepo.update({ id }, { ...data });
  }


  async bossCurrLeft({ filialId, month, year }) {
    const cacheKey = `bossCurrentLeft:${filialId || 'all'}:${month}:${year}`;
    const cacheTTL = 180; // 3 minutes in seconds

    // 1. Try to get from cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }


    const dealer_qb = this.filialRepository
      .createQueryBuilder('filial')
      .select([
        `COALESCE(SUM(filial.owed), 0)::NUMERIC(20, 2) as total_owed,
         COALESCE(SUM(filial.given), 0)::NUMERIC(20, 2) as total_give`,
      ])
      .where('filial.type = :type', { type: FilialType.DEALER })
      .andWhere('filial.isActive = true');

    const latestPriceSubQuery = this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ON (cp."collectionId") cp."collectionId"', 'collectionId')
      .addSelect('cp."priceMeter"', 'priceMeter')
      .addSelect('cp."comingPrice"', 'comingPrice')
      .from('collection-price', 'cp')
      .where(`cp.type = 'filial'`)
      .orderBy('cp."collectionId"')
      .addOrderBy('cp."date"', 'DESC');

    const baseWhere = [
      'p.count > 0',
      'p.y > 0.1',
      'p.is_deleted = false',
      `f.type != 'dealer'`,
    ];

    let dateFilter: Date | null = null;
    if (month && year) {
      // JS months are 0-based, so month + 1 then day 0 gives last day of desired month
      dateFilter = new Date(+year, +month, 0, 23, 59, 59);
    }

    if (filialId) baseWhere.push('p."filialId" = :filialId');
    if (dateFilter) baseWhere.push('p.date <= :dateFilter');

    const product_qb = this.productRepo
      .createQueryBuilder('p')
      .select([
        `COALESCE(SUM(s.x * p.y * p.count), 0)::NUMERIC(20, 2) as "totalKv"`,
        `COALESCE(SUM(p.count), 0) as "totalCount"`,
        `COALESCE(SUM(s.x * p.count * p.y * lp."priceMeter"), 0)::NUMERIC(20, 2) as "totalPrice"`,
        `COALESCE(SUM(s.x * p.count * p.y * lp."comingPrice"), 0)::NUMERIC(20, 2) as "comingPrice"`,
      ])
      .innerJoin('p.bar_code', 'q')
      .innerJoin('q.size', 's')
      .innerJoin('q.collection', 'c')
      .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
      .innerJoin('p.filial', 'f')
      .where(baseWhere.join(' AND '))
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        dateFilter,
      });

    const kents_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE
               WHEN cash.type = 'income'
                   THEN price
               ELSE 0 END)::NUMERIC(20, 2) AS total_sum,
       SUM(CASE
               WHEN cash.type = 'expense'
                   THEN price
               ELSE 0 END)::NUMERIC(20, 2) AS total_expense
      `)
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .where('cashflow_type.slug = :slug', { slug: 'kent' });

    const qb = this.packageTransfer.createQueryBuilder('pt')
      .select([
        'COALESCE(SUM(pt.total_sum), 0)::NUMERIC(20, 2) AS total_sum',
        'COALESCE(SUM(pt.total_profit_sum), 0)::NUMERIC(20, 2) AS total_profit_sum',
        'COALESCE(SUM(pt.total_kv), 0)::NUMERIC(20, 2) AS total_kv',
        'COALESCE(SUM(pt.total_count), 0)::NUMERIC(20, 2) AS total_count',
      ])
      .where('pt.status = :status', { status: PackageTransferEnum.Accept });

    const order_qb = this.orderRepo.createQueryBuilder('ord')
      .leftJoin('ord.bar_code', 'bar_code')
      .leftJoin('ord.kassa', 'kassa')
      .select([
        `COALESCE(SUM(ord.price + ord.plasticSum), 0)::NUMERIC(20, 2) AS total_sum`,
        `COALESCE(SUM(ord.kv), 0)::NUMERIC(20, 2) AS total_kv`,
        `COALESCE(SUM(ord.netProfitSum), 0)::NUMERIC(20, 2) AS total_profit_sum`,
        `
      SUM(CASE
        WHEN bar_code.isMetric = true THEN 1
        ELSE ord.x
      END)::NUMERIC(20, 2) as total_count
      `,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.price ELSE 0 END), 0)::NUMERIC(20, 2) as total_debtSum`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.kv ELSE 0 END), 0)::NUMERIC(20, 2) as total_debtSize`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.netProfitSum ELSE 0 END), 0)::NUMERIC(20, 2) as total_debtProfitSum`,
        `
      SUM(CASE
        WHEN ord.isDebt = true THEN CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END
        ELSE 0
      END)::NUMERIC(20, 2) as total_debtCount
      `,
      ])
      .where('ord.status = :status', { status: OrderEnum.Accept });

    const [dealer_totals, product_totals, kents_result, result, order_result] = await Promise.all([
      dealer_qb.getRawOne(),
      product_qb.getRawOne(),
      kents_qb.getRawOne(),
      qb.getRawOne(),
      order_qb.getRawOne(),
    ]);

    const resultData = {
      totals: {
        total_sum: +((Number(result.total_sum) + Number(order_result.total_sum)).toFixed(2)),
        total_profit_sum: +((Number(result.total_profit_sum) + Number(order_result.total_profit_sum)).toFixed(2)),
        total_kv: +((Number(result.total_kv) + Number(order_result.total_kv)).toFixed(2)),
        total_count: +((Number(result.total_count) + Number(order_result.total_count)).toFixed(2)),
      },
      dealer: {
        total_give: Number(dealer_totals?.total_give),
        total_owed: Number(dealer_totals?.total_owed),
      },
      product: {
        total_kv: Number(product_totals.totalKv),
        total_sum: Number(product_totals.totalPrice),
        total_profit_sum: Number(product_totals.comingPrice),
        total_count: Number(product_totals.totalCount),
      },
      kents: {
        income: Number(kents_result.total_sum),
        expense: Number(kents_result.total_expense),
        debt_balance: Number((Number(kents_result.total_sum) - Number(kents_result.total_expense)).toFixed(2)),
      },
      filial_plan_totals: null,
      user_plan_totals: null,
    };

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);


    return resultData;
  }


  async getByPackage({
                       mode = 'list',
                       package_id,
                       toId,
                       page = 1,
                       limit = 10,
                       search,
                       month,
                       year,
                     }) {
    if (!['list', 'collection', 'country', 'factory'].includes(mode)) {
      throw new BadRequestException(`Invalid mode: ${mode}`);
    }
    const offset = (page - 1) * limit;

    const d_manager = await this.userRepository.findOne({
      where: { position: { role: UserRoleEnum.D_MANAGER } },
      relations: { avatar: true },
    });

    // Optional month/year filter
    let startOfMonth: Date | null = null;
    let endOfMonth: Date | null = null;
    let hasDateFilter = false;

    if (month && year) {
      hasDateFilter = true;
      const filterMonth = Number(month);
      const filterYear = Number(year);
      startOfMonth = dayjs(`${filterYear}-${filterMonth}-01`).startOf('month').toDate();
      endOfMonth = dayjs(startOfMonth).endOf('month').toDate();
    }

    // ============================================
    // MODE: LIST
    // ============================================
    if (mode === 'list') {
      const queryBuilder = this.transferRepository
        .createQueryBuilder('t')
        .leftJoinAndSelect('t.product', 'p')
        .leftJoinAndSelect('t.transferer', 'transferer')
        .leftJoinAndSelect('transferer.avatar', 'transferer_avatar')
        .leftJoinAndSelect('t.courier', 'courier')
        .leftJoinAndSelect('courier.avatar', 'courier_avatar')
        .leftJoinAndSelect('p.bar_code', 'b')
        .leftJoinAndSelect('b.size', 's')
        .leftJoinAndSelect('b.style', 'st')
        .leftJoinAndSelect('b.collection', 'c')
        .leftJoinAndSelect('b.country', 'cou')
        .leftJoinAndSelect('b.model', 'm')
        .leftJoinAndSelect('b.shape', 'sh')
        .leftJoinAndSelect('b.color', 'co')
        .leftJoin('t.package', 'pck')
        .leftJoinAndMapOne(
          't.manager', // -> result.manager
          User, // User entity
          'manager',
          'manager.id = :managerId',
          { managerId: d_manager.id },
        )
        .leftJoinAndMapOne(
          'manager.avatar', // -> result.manager.avatar
          Media, // avatar entity
          'manager_avatar',
          'manager_avatar.id = manager.avatarId',
        )
        .orderBy('t.date', 'DESC')
        .addOrderBy('t.order_index', 'ASC')
        .offset(offset)
        .limit(limit);

      // ---------------------------------------------
      // BUILD WHERE CONDITIONS CLEANLY
      // ---------------------------------------------
      const whereClauses: string[] = [];
      const params: any = {};

      // Progress filter
      whereClauses.push(`t.progress IN ('Processing', 'Accepted')`);

      // Date filter
      if (hasDateFilter) {
        whereClauses.push(
          `t.date BETWEEN (:startOfMonth)::timestamp AND (:endOfMonth)::timestamp`,
        );
        params.startOfMonth = startOfMonth;
        params.endOfMonth = endOfMonth;
      }

      // Package filter
      if (package_id) {
        whereClauses.push(`t."packageId" = :package_id`);
        params.package_id = package_id;
      } else {
        whereClauses.push(`pck.status = 'accepted'`);
      }

      // ToId filter
      if (toId) {
        whereClauses.push(`t."toId" = :toId`);
        params.toId = toId;
      }

      // Apply WHERE
      queryBuilder.where(whereClauses.join(' AND '), params);

      // ---------------------------------------------
      // TOTALS QUERY (same filters, same params!)
      // ---------------------------------------------
      const totals_qb = this.transferRepository
        .createQueryBuilder('t')
        .select([
          `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
          `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
          `COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
            ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
          `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
        ])
        .innerJoin('t.bar_code', 'q')
        .innerJoin('q.collection', 'c')
        .innerJoin(
          qb =>
            qb
              .select([
                'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                'cp."priceMeter" AS "priceMeter"',
              ])
              .from('collection-price', 'cp')
              .where(`cp.type = 'filial'`)
              .orderBy('cp."collectionId"')
              .addOrderBy('cp."date"', 'DESC'),
          'lp',
          `lp."collectionId" = c.id`,
        )
        // pck aliasni JOIN qildik, chunki whereClauses ichida ishlatiladi
        .leftJoin('t.package', 'pck')
        .where(whereClauses.join(' AND '), params);

      // ---------------------------------------------
      // EXECUTE BOTH QUERIES
      // ---------------------------------------------
      const [[items, total], totals] = await Promise.all([
        queryBuilder.getManyAndCount(),
        totals_qb.getRawOne(),
      ]);

      return {
        items,
        meta: {
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
        },
        totals: {
          totalKv: Number(totals?.totalKv ?? 0),
          total_sum: Number(totals?.total_sum ?? 0),
          total_profit_sum: Number(totals?.total_profit_sum ?? 0),
          total_count: Number(totals?.total_count ?? 0),
        },
      };
    }

    // ============================================
    // MODE: COLLECTION
    // ============================================
    if (mode === 'collection') {
      const offset = (page - 1) * limit;

      const whereConditions = [`t.progres IN ('Processing', 'Accepted')`];
      const params: any[] = [];
      let paramIndex = 1;

      if (hasDateFilter) {
        whereConditions.push(`t.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(startOfMonth, endOfMonth);
      }

      if (package_id) {
        whereConditions.push(`t."packageId" = $${paramIndex++}`);
        params.push(package_id);
      } else {
        whereConditions.push(`pck.status = 'accepted'`);
      }

      if (toId) {
        whereConditions.push(`t."toId" = $${paramIndex++}`);
        params.push(toId);
      }

      const whereSQL = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const rawQuery = `
      WITH latest_price AS (
        SELECT DISTINCT ON (cp."collectionId")
               cp."collectionId",
               cp."priceMeter",
               cp."comingPrice"
        FROM "collection-price" cp
        WHERE cp.type = 'filial'
        ORDER BY cp."collectionId", cp."date" DESC
      )
      SELECT
        c.id,
        c.title,
        json_build_object('id', c.id, 'title', c.title) as collection,
        SUM(COALESCE(t.kv, 0)) AS total_kv,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS total_count,

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_sum,

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_profit_sum,

        SUM(COALESCE(t.kv, 0)) AS "totalKv",
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS "totalCount",

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalPrice",

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalNetProfitPrice",

        JSONB_AGG(DISTINCT cp) AS collection_prices
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
        LEFT JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "collection-price" cp
          ON c.id = cp."collectionId" AND cp.type = 'filial'
      ${whereSQL}
      GROUP BY c.id, c.title
      ORDER BY c.title
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

      const countQuery = `
      SELECT COUNT(DISTINCT c.id)
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
      ${whereSQL}
    `;

      const queryParams = [...params, limit, offset];

      const [items, total, totals] = await Promise.all([
        this.dataSource.query(rawQuery, queryParams),
        this.dataSource.query(countQuery, params).then(res => Number(res[0]?.count || 0)),
        this.transferRepository
          .createQueryBuilder('t')
          .select([
            `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
            `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
            `COALESCE(SUM(
            CASE
              WHEN t."comingPrice" = 0 THEN 0
              WHEN t."comingPrice" > lp."priceMeter"
                THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
              ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
            END
          ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
            `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
          ])
          .innerJoin('t.bar_code', 'q')
          .innerJoin('q.collection', 'c')
          .leftJoin('t.package', 'pck')
          .innerJoin(
            qb =>
              qb
                .select([
                  'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                  'cp."priceMeter" AS "priceMeter"',
                ])
                .from('collection-price', 'cp')
                .where(`cp.type = 'filial'`)
                .orderBy('cp."collectionId"')
                .addOrderBy('cp."date"', 'DESC'),
            'lp',
            'lp."collectionId" = c.id',
          )
          .where(`t.progress IN ('Processing', 'Accepted')`)
          .andWhere(hasDateFilter ? 't.date BETWEEN :start AND :end' : '1=1', {
            start: startOfMonth,
            end: endOfMonth,
          })
          .andWhere(package_id ? 't."packageId" = :package_id' : '1=1', { package_id })
          .andWhere('pck.status = \'accepted\'')
          .andWhere(toId ? 't."toId" = :toId' : '1=1', { toId })
          .getRawOne(),
      ]);

      return {
        items,
        meta: {
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit),
          },
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
          totals: {
            totalKv: Number(totals?.totalKv ?? 0),
            totalPrice: Number(totals?.total_sum ?? 0),
            totalNetProfitPrice: Number(totals?.total_profit_sum ?? 0),
            totalCount: Number(totals?.total_count ?? 0),
          },
        },
        totals: {
          totalKv: Number(totals?.totalKv ?? 0),
          total_sum: Number(totals?.total_sum ?? 0),
          total_profit_sum: Number(totals?.total_profit_sum ?? 0),
          total_count: Number(totals?.total_count ?? 0),
        },
      };
    }

    // ============================================
    // MODE: COUNTRY
    // ============================================
    if (mode === 'country') {
      const offset = (page - 1) * limit;

      const whereConditions = [`t.progres IN ('Processing', 'Accepted')`];
      const params: any[] = [];
      let paramIndex = 1;

      if (hasDateFilter) {
        whereConditions.push(`t.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(startOfMonth, endOfMonth);
      }

      if (package_id) {
        whereConditions.push(`t."packageId" = $${paramIndex++}`);
        params.push(package_id);
      } else {
        whereConditions.push(`pck.status = 'accepted'`);
      }

      if (toId) {
        whereConditions.push(`t."toId" = $${paramIndex++}`);
        params.push(toId);
      }

      const whereSQL = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const rawQuery = `
      WITH latest_price AS (
        SELECT DISTINCT ON (cp."collectionId")
               cp."collectionId",
               cp."priceMeter",
               cp."comingPrice"
        FROM "collection-price" cp
        WHERE cp.type = 'filial'
        ORDER BY cp."collectionId", cp."date" DESC
      )
      SELECT
        ct.id,
        ct.title,
        json_build_object('id', ct.id, 'title', ct.title) as country,
        SUM(COALESCE(t.kv, 0)) AS total_kv,
        SUM(COALESCE(t.kv, 0)) AS totalKv,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS total_count,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS "totalCount",

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_sum,
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalPrice",

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_profit_sum,
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalNetProfitPrice"
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN country ct ON q."countryId" = ct.id
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
        LEFT JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "collection-price" cp
          ON c.id = cp."collectionId" AND cp.type = 'filial'
      ${whereSQL}
      GROUP BY ct.id, ct.title
      ORDER BY ct.title
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

      const countQuery = `
      SELECT COUNT(DISTINCT ct.id)
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN country ct ON q."countryId" = ct.id
      ${whereSQL}
    `;

      const queryParams = [...params, limit, offset];

      const [items, total, totals] = await Promise.all([
        this.dataSource.query(rawQuery, queryParams),
        this.dataSource.query(countQuery, params).then(res => Number(res[0]?.count || 0)),
        this.transferRepository
          .createQueryBuilder('t')
          .select([
            `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
            `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
            `COALESCE(SUM(
            CASE
              WHEN t."comingPrice" = 0 THEN 0
              WHEN t."comingPrice" > lp."priceMeter"
                THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
              ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
            END
          ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
            `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
          ])
          .innerJoin('t.bar_code', 'q')
          .innerJoin('q.collection', 'c')
          .leftJoin('t.package', 'pck')
          .innerJoin(
            qb =>
              qb
                .select([
                  'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                  'cp."priceMeter" AS "priceMeter"',
                ])
                .from('collection-price', 'cp')
                .where(`cp.type = 'filial'`)
                .orderBy('cp."collectionId"')
                .addOrderBy('cp."date"', 'DESC'),
            'lp',
            'lp."collectionId" = c.id',
          )
          .where(`t.progress IN ('Processing', 'Accepted')`)
          .andWhere(hasDateFilter ? 't.date BETWEEN :start AND :end' : '1=1', {
            start: startOfMonth,
            end: endOfMonth,
          })
          .andWhere(package_id ? 't."packageId" = :package_id' : '1=1', { package_id })
          .andWhere('pck.status = \'accepted\'')
          .andWhere(toId ? 't."toId" = :toId' : '1=1', { toId })
          .getRawOne(),
      ]);

      return {
        items,
        meta: {
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit),
          },
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
          totals: {
            totalKv: Number(totals?.totalKv ?? 0),
            totalSellPrice: Number(totals?.total_sum ?? 0),
            totalPrice: Number(totals?.total_sum ?? 0),
            totalNetProfitPrice: Number(totals?.total_profit_sum ?? 0),
            totalCount: Number(totals?.total_count ?? 0),
          },
        },
      };
    }

    // ============================================
    // MODE: FACTORY
    // ============================================
    if (mode === 'factory') {
      const offset = (page - 1) * limit;

      const whereConditions = [`t.progres IN ('Processing', 'Accepted')`];
      const params: any[] = [];
      let paramIndex = 1;

      if (hasDateFilter) {
        whereConditions.push(`t.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(startOfMonth, endOfMonth);
      }

      if (package_id) {
        whereConditions.push(`t."packageId" = $${paramIndex++}`);
        params.push(package_id);
      } else {
        whereConditions.push(`pck.status = 'accepted'`);
      }

      if (toId) {
        whereConditions.push(`t."toId" = $${paramIndex++}`);
        params.push(toId);
      }

      const whereSQL = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const rawQuery = `
      WITH latest_price AS (
        SELECT DISTINCT ON (cp."collectionId")
               cp."collectionId",
               cp."priceMeter",
               cp."comingPrice"
        FROM "collection-price" cp
        WHERE cp.type = 'filial'
        ORDER BY cp."collectionId", cp."date" DESC
      )
      SELECT
        fa.id,
        fa.title,
        json_build_object('id', fa.id, 'title', fa.title) as factory,
        SUM(COALESCE(t.kv, 0)) AS total_kv,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS total_count,

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_sum,

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_profit_sum,

        SUM(COALESCE(t.kv, 0)) AS "totalKv",
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS totalCount,

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalPrice",

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalNetProfitPrice"
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN country ct ON q."countryId" = ct.id
        LEFT JOIN factory fa ON q."factoryId" = fa.id
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
        LEFT JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "collection-price" cp
          ON c.id = cp."collectionId" AND cp.type = 'filial'
      ${whereSQL}
      GROUP BY fa.id, fa.title
      ORDER BY fa.title
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

      const countQuery = `
      SELECT COUNT(DISTINCT fa.id)
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN factory fa ON q."factoryId" = fa.id
      ${whereSQL}
    `;

      const queryParams = [...params, limit, offset];

      const [items, total, totals] = await Promise.all([
        this.dataSource.query(rawQuery, queryParams),
        this.dataSource.query(countQuery, params).then(res => Number(res[0]?.count || 0)),
        this.transferRepository
          .createQueryBuilder('t')
          .select([
            `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
            `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
            `COALESCE(SUM(
            CASE
              WHEN t."comingPrice" = 0 THEN 0
              WHEN t."comingPrice" > lp."priceMeter"
                THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
              ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
            END
          ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
            `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
          ])
          .innerJoin('t.bar_code', 'q')
          .innerJoin('q.collection', 'c')
          .leftJoin('t.package', 'pck')
          .innerJoin(
            qb =>
              qb
                .select([
                  'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                  'cp."priceMeter" AS "priceMeter"',
                ])
                .from('collection-price', 'cp')
                .where(`cp.type = 'filial'`)
                .orderBy('cp."collectionId"')
                .addOrderBy('cp."date"', 'DESC'),
            'lp',
            'lp."collectionId" = c.id',
          )
          .where(`t.progress IN ('Processing', 'Accepted')`)
          .andWhere(hasDateFilter ? 't.date BETWEEN :start AND :end' : '1=1', {
            start: startOfMonth,
            end: endOfMonth,
          })
          .andWhere(package_id ? 't."packageId" = :package_id' : '1=1', { package_id })
          .andWhere('pck.status = \'accepted\'')
          .andWhere(toId ? 't."toId" = :toId' : '1=1', { toId })
          .getRawOne(),
      ]);

      return {
        items,
        meta: {
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit),
          },
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
          totals: {
            totalKv: Number(totals?.totalKv ?? 0),
            totalSellPrice: Number(totals?.total_sum ?? 0),
            totalPrice: Number(totals?.total_sum ?? 0),
            totalNetProfitPrice: Number(totals?.total_profit_sum ?? 0),
            totalCount: Number(totals?.total_count ?? 0),
          },
        },
      };
    }
  }


// service ichida

  async bossMonthReport({ month, year, filialId }) {
    const { normalizedYear, startDate, endDate } = this.getYearAndDateRange(month, year);

    const cacheKey = `bossCurrentMonthAllReport:${filialId || 'all'}:${month || 'all'}:${normalizedYear}`;
    const cacheTTL = 180;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // --- Typelar ---
    type PriceKv = { price: number; kv: number };

    // Dealer reports (filialType=dealer) — PackageTransfer o'rniga
    const dealer_report_qb = this.reportRepo.createQueryBuilder('dr')
      .select([
        'COALESCE(SUM(dr."totalSale"), 0)::NUMERIC(20, 2) AS total_sale',
        'COALESCE(SUM(dr."totalSize"), 0)::NUMERIC(20, 2) AS total_size',
        'COALESCE(SUM(dr."totalDiscount"), 0)::NUMERIC(20, 2) AS total_discount',
        'COALESCE(SUM(dr."netProfitSum"), 0)::NUMERIC(20, 2) AS net_profit',
        'COALESCE(SUM(dr.debtSum), 0)::NUMERIC(20, 2) AS debtSum',
        'COALESCE(SUM(dr.debtSize), 0)::NUMERIC(20, 2) AS debtSize',
        'COALESCE(SUM(dr.debtProfitSum), 0)::NUMERIC(20, 2) AS debtProfitSum',
      ])
      .where('dr."filialType" = :dealerType', { dealerType: 'dealer' });

    // Orderlar bo'yicha oborot
    const order_qb = this.orderRepo.createQueryBuilder('ord')
      .leftJoin('ord.bar_code', 'bar_code')
      .leftJoin('ord.kassa', 'kassa')
      .select([
        `COALESCE(SUM(ord.price + ord."plasticSum"), 0)::NUMERIC(20, 2) AS total_sum`,
        `COALESCE(SUM(ord.kv), 0)::NUMERIC(20, 2) AS total_kv`,
        `COALESCE(SUM(ord.netProfitSum), 0)::NUMERIC(20, 2) AS total_profit_sum`,
        `COALESCE(SUM(ord.discountSum), 0)::NUMERIC(20, 2) AS total_discount`,
        `
      SUM(
        CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END
      )::NUMERIC(20, 2) as total_count
      `,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.price ELSE 0 END), 0)::NUMERIC(20, 2) as total_debtSum`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.kv ELSE 0 END), 0)::NUMERIC(20, 2) as total_debtSize`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.netProfitSum ELSE 0 END), 0)::NUMERIC(20, 2) as total_debtProfitSum`,
        `
      SUM(
        CASE WHEN ord.isDebt = true THEN (CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END)
        ELSE 0 END
      )::NUMERIC(20, 2) as total_debtCount
      `,
      ])
      .where('ord.status IN(:...status)', { status: [OrderEnum.Accept, OrderEnum.Return] });

    // Dealer kassa (naqd/online)
    const dealer_cash_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.is_online = FALSE THEN price ELSE 0 end) as cash,
      SUM(CASE WHEN cash.is_online = TRUE THEN price ELSE 0 end) as online
    `)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'dealer'`);

    // Filial kassadan chiqim (manager + buxgalter)
    const kassa_cash_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug IN ('manager', 'accountant') AND cash.type = 'expense'`);

    // Kassa (plastik, inkassa, opening, inHand, qaytishlar, qo'shimcha foyda)
    const plastic_cash_and_opening_qb = this.kassaRepo.createQueryBuilder('k')
      .select(`
      SUM("plasticSum") as price,
      SUM("cashCollection") as cashCollection,
      SUM("openingBalance") as openingBalance,
      SUM(inHand) as inHand,
      SUM("additionalProfitSum") as add_profit,
      SUM("totalSaleReturn") as saleReturn,
      SUM("totalSaleSizeReturn") as sizeReturn,
      SUM("netProfitSum") as net_profit_kassa,
      SUM("discount") as discount_kassa
    `)
      .where(`k."filialType" = 'filial'`);

    // Opening balance (Balance turi)
    const openingBalance_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug = 'balance' AND cash.type = 'income'`);

    // Qarzdan tushgan pul (qarz, qarzdanKelgan)
    const coming_debt_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug IN ('debt', 'debt_repayment') AND cash.type = 'income'`);

    // Boss (boshlik) bo'yicha kirim/chiqim
    const boss_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'income' THEN price ELSE 0 END) as income,
      SUM(CASE WHEN cash.type = 'expense' THEN price ELSE 0 END) as expense
    `)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug = 'boss'`);

    // Kent (dolg)
    const kent_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'income' THEN price ELSE 0 END) as income,
      SUM(CASE WHEN cash.type = 'expense' THEN price ELSE 0 END) as expense
    `)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug IN ('kent')`);

    // Business xarajatlar (logistika alohida)
    const business_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(
        `ct.slug IN ('bank', 'credit', 'business', 'other', 'tax', 'rent', 'shop')
       AND cash.type = 'expense'`,
      );

    // Logistika (alohida)
    const logistics_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'logistics' AND cash.type = 'expense'`);

    // Qo'shimcha prixodlar
    const extra_income_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'other' AND cash.type = 'income'`);

    // Factory
    const factory_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'factory' AND cash.type = 'expense'`);

    // Tamojnya
    const customs_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'customs' AND cash.type = 'expense'`);

    // Qo'shimcha foyda xarajatga ketgan qismi (navar, Расход)
    const add_profit_exp_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug = 'markup' AND cash.type = 'expense'`);

    // dealer report month/year filter
    this.applyKassaMonthYearFilter(dealer_report_qb, 'dr', month, normalizedYear);

    this.applyDateRangeFilter(dealer_cash_qb, 'cash.date', startDate, endDate);

    this.applyDateRangeFilter(kassa_cash_qb, 'k.createdAt', startDate, endDate);

    this.applyDateRangeFilter(kent_qb, 'cash.date', startDate, endDate);
    this.applyDateRangeFilter(factory_qb, 'cash.date', startDate, endDate);
    this.applyDateRangeFilter(customs_qb, 'cash.date', startDate, endDate);
    this.applyDateRangeFilter(logistics_qb, 'cash.date', startDate, endDate);
    this.applyDateRangeFilter(extra_income_qb, 'cash.date', startDate, endDate);

    this.applyDateRangeFilter(add_profit_exp_qb, 'k.createdAt', startDate, endDate);

    this.applyKassaMonthYearFilter(order_qb, 'kassa', month, normalizedYear);
    this.applyKassaMonthYearFilter(business_qb, 'k', month, normalizedYear);
    this.applyKassaMonthYearFilter(coming_debt_qb, 'k', month, normalizedYear);
    this.applyKassaMonthYearFilter(openingBalance_qb, 'k', month, normalizedYear);
    this.applyKassaMonthYearFilter(plastic_cash_and_opening_qb, 'k', month, normalizedYear);

    // Report summary — manager/bugalter balans va saldo (o'tgan oydan)
    const report_summary_qb = this.reportRepo.createQueryBuilder('rs')
      .select([
        'COALESCE(SUM(rs."managerSum"), 0)::NUMERIC(20, 2) AS manager_sum',
        'COALESCE(SUM(rs."accountantSum"), 0)::NUMERIC(20, 2) AS accountant_sum',
        'COALESCE(SUM(rs."managerSaldo"), 0)::NUMERIC(20, 2) AS manager_saldo',
        'COALESCE(SUM(rs."accountantSaldo"), 0)::NUMERIC(20, 2) AS accountant_saldo',
      ])
      .where('rs."filialType" = :rsType', { rsType: 'filial' });
    this.applyKassaMonthYearFilter(report_summary_qb, 'rs', month, normalizedYear);

    let resultData: {
      turnover: PriceKv;
      debt_trading: PriceKv;
      discount: PriceKv;
      profit: PriceKv;
      profit_remaining: PriceKv;    // foyda qoldig'i = foyda - biznes rasxod
      cash: PriceKv;
      terminal: PriceKv;
      cashCollection: PriceKv;
      dealer_cash: PriceKv;
      dealer_terminal: PriceKv;
      owed_debt: PriceKv;
      openingBalance: PriceKv;
      filial_balance: PriceKv;
      manager_balance: PriceKv;     // manager balansi
      accountant_balance: PriceKv;  // bugalter balansi
      boss_income: PriceKv;
      kent_income: PriceKv;
      kent_expense: PriceKv;
      boss_expense: PriceKv;
      business_expense: PriceKv;
      logistics: PriceKv;           // logistika (alohida)
      extra_income: PriceKv;        // qo'shimcha prixodlar
      factory: PriceKv;
      return_orders: PriceKv;
      tamojniy: PriceKv;
      navar_expense: PriceKv;
      navar_income: PriceKv;
    };

    if (filialId === '#dealers') {
      // Diller rejimi: DealerReport + diller cashflowlar
      const [dealer_report, dealer_cashs] = await Promise.all([
        dealer_report_qb.getRawOne(),
        dealer_cash_qb.getRawOne(),
      ]);

      resultData = {
        turnover: {
          // FIX: dealer turnover = debtSum (package qarz savdosi)
          price: Number(dealer_report?.debtSum ?? 0),
          kv: Number(dealer_report?.debtSize ?? 0),
        },
        debt_trading: {
          price: Number(dealer_report?.debtSum ?? 0),
          kv: Number(dealer_report?.debtSize ?? 0),
        },
        discount: {
          price: Number(dealer_report?.total_discount ?? 0),
          kv: 0,
        },
        profit: {
          // FIX: dealer profit = debtProfitSum (package qarz savdosi foydasi)
          price: Number(dealer_report?.debtProfitSum ?? 0),
          kv: 0,
        },
        profit_remaining: { price: 0, kv: 0 },              // dillerda yo'q
        cash: { price: 0, kv: 0 },
        terminal: { price: 0, kv: 0 },
        cashCollection: { price: 0, kv: 0 },
        dealer_cash: {
          price: Number(dealer_cashs?.cash ?? 0),
          kv: 0,
        },
        dealer_terminal: {
          price: Number(dealer_cashs?.online ?? 0),
          kv: 0,
        },
        owed_debt: { price: 0, kv: 0 },
        openingBalance: { price: 0, kv: 0 },
        filial_balance: { price: 0, kv: 0 },
        manager_balance: { price: 0, kv: 0 },
        accountant_balance: { price: 0, kv: 0 },
        boss_income: { price: 0, kv: 0 },
        kent_income: { price: 0, kv: 0 },
        kent_expense: { price: 0, kv: 0 },
        boss_expense: { price: 0, kv: 0 },
        business_expense: { price: 0, kv: 0 },
        logistics: { price: 0, kv: 0 },
        extra_income: { price: 0, kv: 0 },
        factory: { price: 0, kv: 0 },
        return_orders: { price: 0, kv: 0 },
        tamojniy: { price: 0, kv: 0 },
        navar_expense: { price: 0, kv: 0 },
        navar_income: { price: 0, kv: 0 },
      };
    }

    else if (filialId) {
      // Filial rejimi
      this.applyDateRangeFilter(boss_qb, 'k.createdAt', startDate, endDate);
      boss_qb.andWhere('cash.filialId = :filialId', { filialId });

      // Filial kesimlari — faqat shu filialga tegishli
      business_qb.andWhere('k.filialId = :filialId', { filialId });
      order_qb.andWhere('kassa.filialId = :filialId', { filialId });
      kassa_cash_qb.andWhere('cash.filialId = :filialId', { filialId });
      coming_debt_qb.andWhere('k.filialId = :filialId', { filialId });
      openingBalance_qb.andWhere('k.filialId = :filialId', { filialId });
      add_profit_exp_qb.andWhere('cash.filialId = :filialId', { filialId });
      plastic_cash_and_opening_qb.andWhere('k.filialId = :filialId', { filialId });
      report_summary_qb.andWhere('rs."filialId" = :rsFilialId', { rsFilialId: filialId });

      const [
        order_totals,
        kassa_cash,
        plastic_cash_and_opening,
        coming_debt,
        boss,
        business,
        add_profit_exp,
        openingBalance,
        report_summary,
      ] = await Promise.all([
        order_qb.getRawOne(),
        kassa_cash_qb.getRawOne(),
        plastic_cash_and_opening_qb.getRawOne(),
        coming_debt_qb.getRawOne(),
        boss_qb.getRawOne(),
        business_qb.getRawOne(),
        add_profit_exp_qb.getRawOne(),
        openingBalance_qb.getRawOne(),
        report_summary_qb.getRawOne(),
      ]);

      // FIX: O'tgan pul = faqat cashflow.slug='balance' AND type='income' yig'indisi
      const openingTotal = Number(openingBalance?.cash ?? 0);

      resultData = {
        turnover: {
          price: Number(order_totals?.total_sum ?? 0),
          kv: Number(order_totals?.total_kv ?? 0),
        }, // savdo aylanmasi
        debt_trading: {
          price: Number(order_totals?.total_debtSum ?? 0),
          kv: Number(order_totals?.total_debtSize ?? 0),
        }, // qarz savdosi
        discount: {
          // FIX: Kassa.discount (filial uchun)
          price: Number(plastic_cash_and_opening?.discount_kassa ?? 0),
          kv: 0,
        }, // chegirma
        profit: {
          // FIX: Kassa.netProfitSum (filial uchun)
          price: Number(plastic_cash_and_opening?.net_profit_kassa ?? 0),
          kv: 0,
        }, // foyda hisobi
        profit_remaining: { price: 0, kv: 0 }, // filialda ko'rinmaydi
        cash: {
          price: Number(kassa_cash?.cash ?? 0),
          kv: 0,
        }, // naqd kassa
        terminal: {
          price: Number(plastic_cash_and_opening?.price ?? 0),
          kv: 0,
        }, // terminal
        cashCollection: {
          price: Number(plastic_cash_and_opening?.cashCollection ?? 0),
          kv: 0,
        }, // inkassatsiya
        dealer_cash: { price: 0, kv: 0 },     // filialda yo'q
        dealer_terminal: { price: 0, kv: 0 }, // filialda yo'q
        owed_debt: {
          price: Number(coming_debt?.cash ?? 0),
          kv: 0,
        }, // kelgan qarzlar
        openingBalance: {
          price: openingTotal,
          kv: 0,
        }, // o'tgan pul = kassa opening + saldo
        filial_balance: {
          price: Number(plastic_cash_and_opening?.inHand ?? 0),
          kv: 0,
        }, // filial balansi
        manager_balance: {
          price: Number(report_summary?.manager_sum ?? 0),
          kv: 0,
        }, // manager balansi
        accountant_balance: {
          price: Number(report_summary?.accountant_sum ?? 0),
          kv: 0,
        }, // bugalter balansi
        boss_income: {
          price: Number(boss?.income ?? 0),
          kv: 0,
        }, // boss prixod
        kent_income: { price: 0, kv: 0 },     // filialda yo'q
        kent_expense: { price: 0, kv: 0 },    // filialda yo'q
        boss_expense: {
          price: Number(boss?.expense ?? 0),
          kv: 0,
        }, // boss rasxod
        business_expense: {
          price: Number(business?.cash ?? 0),
          kv: 0,
        }, // biznes rasxod
        logistics: { price: 0, kv: 0 },       // filialda yo'q
        extra_income: { price: 0, kv: 0 },    // filialda yo'q
        factory: { price: 0, kv: 0 },         // filialda yo'q
        return_orders: {
          price: Number(plastic_cash_and_opening?.totalSaleReturn ?? 0),
          kv: Number(plastic_cash_and_opening?.sizeReturn ?? 0),
        }, // qaytgan tavarlar
        tamojniy: { price: 0, kv: 0 },        // filialda yo'q
        navar_expense: {
          price: Number(add_profit_exp?.cash ?? 0),
          kv: 0,
        }, // navar rasxod
        navar_income: {
          price: Number(plastic_cash_and_opening?.add_profit ?? 0),
          kv: 0,
        }, // navar kirim
      };
    }

    else {
      // Umumiy rejim — barcha filiallar + dillerlar yig'indisi
      this.applyDateRangeFilter(boss_qb, 'cash.date', startDate, endDate);
      this.applyDateRangeFilter(business_qb, 'cash.date', startDate, endDate);

      const [
        dealer_report,   // DealerReport dan (PackageTransfer o'rniga)
        dealer_cashs,
        order_totals,
        kassa_cash,
        plastic_cash_and_opening,
        coming_debt,
        boss,
        kent,
        business,
        factory,
        customs,
        logistics,       // logistika (alohida)
        extra_income,    // qo'shimcha prixodlar
        add_profit_exp,  // navar rasxod (edi umumiyda 0 edi — BUG FIX)
        report_summary,  // manager/bugalter balans + saldo
        openingBalance, // saldo cashflowlari (slug='balance' AND type='income')
      ] = await Promise.all([
        dealer_report_qb.getRawOne(),
        dealer_cash_qb.getRawOne(),
        order_qb.getRawOne(),
        kassa_cash_qb.getRawOne(),
        plastic_cash_and_opening_qb.getRawOne(),
        coming_debt_qb.getRawOne(),
        boss_qb.getRawOne(),
        kent_qb.getRawOne(),
        business_qb.getRawOne(),
        factory_qb.getRawOne(),
        customs_qb.getRawOne(),
        logistics_qb.getRawOne(),
        extra_income_qb.getRawOne(),
        add_profit_exp_qb.getRawOne(),
        report_summary_qb.getRawOne(),
        openingBalance_qb.getRawOne(),
      ]);

      // Biznes rasxod yig'indisi (foyda qoldig'i uchun)
      const businessTotal = Number(business?.cash ?? 0);
      // Foyda hisobi: FIX — dealer.debtProfitSum + SUM(Kassa.netProfitSum)
      const profitTotal =
        Number(dealer_report?.debtProfitSum ?? 0) +
        Number(plastic_cash_and_opening?.net_profit_kassa ?? 0);
      // O'tgan pul: FIX — faqat cashflow.slug='balance' AND type='income' yig'indisi
      const openingTotal = Number(openingBalance?.cash ?? 0);

      resultData = {
        turnover: {
          // FIX: dealer.debtSum (package qarz savdosi) + barcha kassa orderlari
          price:
            Number(dealer_report?.debtSum ?? 0) +
            Number(order_totals?.total_sum ?? 0),
          kv:
            Number(dealer_report?.debtSize ?? 0) +
            Number(order_totals?.total_kv ?? 0),
        },
        debt_trading: {
          price:
            Number(dealer_report?.debtSum ?? 0) +
            Number(order_totals?.total_debtSum ?? 0),
          kv:
            Number(dealer_report?.debtSize ?? 0) +
            Number(order_totals?.total_debtSize ?? 0),
        },
        discount: {
          // FIX: Kassa.discount + dealer.totalDiscountSum (order.discountSum o'rniga)
          price:
            Number(dealer_report?.total_discount ?? 0) +
            Number(plastic_cash_and_opening?.discount_kassa ?? 0),
          kv: 0,
        },
        profit: {
          price: profitTotal,
          kv: 0,
        },
        profit_remaining: {
          price: profitTotal - businessTotal,            // foyda - biznes rasxod
          kv: 0,
        },
        cash: {
          price: Number(kassa_cash?.cash ?? 0),
          kv: 0,
        },
        terminal: {
          price: Number(plastic_cash_and_opening?.price ?? 0),
          kv: 0,
        },
        cashCollection: {
          price: Number(plastic_cash_and_opening?.cashCollection ?? 0),
          kv: 0,
        },
        dealer_cash: {
          price: Number(dealer_cashs?.cash ?? 0),
          kv: 0,
        },
        dealer_terminal: {
          price: Number(dealer_cashs?.online ?? 0),
          kv: 0,
        },
        owed_debt: {
          price: Number(coming_debt?.cash ?? 0),
          kv: 0,
        },
        openingBalance: {
          price: openingTotal,
          kv: 0,
        },
        filial_balance: {
          price: Number(plastic_cash_and_opening?.inHand ?? 0),
          kv: 0,
        },
        manager_balance: {
          price: Number(report_summary?.manager_sum ?? 0),
          kv: 0,
        },
        accountant_balance: {
          price: Number(report_summary?.accountant_sum ?? 0),
          kv: 0,
        },
        boss_income: {
          price: Number(boss?.income ?? 0),
          kv: 0,
        },
        kent_income: {
          price: Number(kent?.income ?? 0),
          kv: 0,
        },
        kent_expense: {
          price: Number(kent?.expense ?? 0),
          kv: 0,
        },
        boss_expense: {
          price: Number(boss?.expense ?? 0),
          kv: 0,
        },
        business_expense: {
          price: businessTotal,
          kv: 0,
        },
        logistics: {
          price: Number(logistics?.cash ?? 0),           // logistika alohida
          kv: 0,
        },
        extra_income: {
          price: Number(extra_income?.cash ?? 0),        // qo'shimcha prixodlar
          kv: 0,
        },
        factory: {
          price: Number(factory?.cash ?? 0),
          kv: 0,
        },
        return_orders: {
          price: Number(plastic_cash_and_opening?.totalSaleReturn ?? 0),
          kv: Number(plastic_cash_and_opening?.sizeReturn ?? 0),
        },
        tamojniy: {
          price: Number(customs?.cash ?? 0),
          kv: 0,
        },
        navar_expense: {
          price: Number(add_profit_exp?.cash ?? 0),      // BUG FIX: edi 0 edi
          kv: 0,
        },
        navar_income: {
          price: Number(plastic_cash_and_opening?.add_profit ?? 0), // BUG FIX: edi 0 edi
          kv: 0,
        },
      };
    }

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);
    return resultData;
  }

  /**
   * Drill-in detail — har bir qator bo'yicha cashflow yoki filial ro'yxati
   */
  async bossMonthReportDetail({ type, month, year, filialId, tip }: {
    type: string; month?: number; year?: number; filialId?: string; tip?: string;
  }) {
    const { normalizedYear, startDate, endDate } = this.getYearAndDateRange(month, year);

    const cacheKey = `bossReportDetail:${type}:${filialId || 'all'}:${month || 'all'}:${normalizedYear}:${tip || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let items: any[] = [];

    // Cashflow asosidagi querylar uchun umumiy builder
    const makeCashflowQuery = (slugs: string[], cfType: 'income' | 'expense') => {
      const qb = this.cashflowRepository.createQueryBuilder('cash')
        .leftJoinAndSelect('cash.cashflow_type', 'ct')
        .leftJoin('cash.kassa', 'k')
        .leftJoin('cash.report', 'r')
        .leftJoinAndSelect('cash.createdBy', 'u')
        .leftJoinAndSelect('cash.filial', 'f')
        .select([
          'cash.id', 'cash.price', 'cash.type', 'cash.comment',
          'cash.date', 'cash.is_online',
          'ct.id', 'ct.slug', 'ct.title',
          'u.id', 'u.firstName', 'u.lastName',
          'f.id', 'f.title',
        ])
        .where(`ct.slug IN (:...slugs)`, { slugs })
        .andWhere(`cash.type = :cfType`, { cfType })
        .orderBy('cash.date', 'DESC');
      return qb;
    };

    // Kassa-ga bog'langan cashflow query (k.createdAt filtri)
    const makeCashflowByKassa = (slugs: string[], cfType: 'income' | 'expense') => {
      const qb = makeCashflowQuery(slugs, cfType);
      this.applyKassaMonthYearFilter(qb, 'k', month, normalizedYear);
      return qb;
    };

    // cash.date filtri bilan
    const makeCashflowByDate = (slugs: string[], cfType: 'income' | 'expense') => {
      const qb = makeCashflowQuery(slugs, cfType);
      this.applyDateRangeFilter(qb, 'cash.date', startDate, endDate);
      return qb;
    };

    switch (type) {
      // ====== YASHIL BO'LIM (kirimlar) ======

      case 'naqd_kassa': {
        if (tip === 'income') {
          // Umumiy rejim (kirimlar): report ichidagi kassa tipli prixod cashflowlar
          const qb = makeCashflowByDate(['kassa'], 'income');
          items = await qb.getMany();
        } else {
          // Filial rejim (chiqimlar): kassa ichidagi manager/accountant rasxod cashflowlar
          const qb = makeCashflowQuery(['manager', 'accountant'], 'expense');
          this.applyDateRangeFilter(qb, 'k.createdAt', startDate, endDate);
          if (filialId) qb.andWhere('cash.filialId = :filialId', { filialId });
          items = await qb.getMany();
        }
        break;
      }

      case 'terminal': {
        // Filiallar ro'yxati — plasticSum > 0 bo'lganlar
        const qb = this.kassaRepo.createQueryBuilder('k')
          .leftJoinAndSelect('k.filial', 'f')
          .select([
            'f.id AS "filialId"',
            'f.title AS "filialTitle"',
            'SUM(k."plasticSum") AS "plasticSum"',
          ])
          .where('k."filialType" = :ft', { ft: 'filial' })
          .groupBy('f.id')
          .addGroupBy('f.title')
          .having('SUM(k."plasticSum") > 0')
          .orderBy('"plasticSum"', 'DESC');
        this.applyKassaMonthYearFilter(qb, 'k', month, normalizedYear);
        items = await qb.getRawMany();
        break;
      }

      case 'inkassatsiya': {
        // Umumiy: Report ichidagi prixod inkassatsiya cashflowlar
        // Filial: shu filial kassasi rasxod inkassatsiya
        // Inkassatsiya kassa ichida cashCollection sifatida saqlanadi
        // Cashflow sifatida ham bo'lishi mumkin
        const qb = this.kassaRepo.createQueryBuilder('k')
          .leftJoinAndSelect('k.filial', 'f')
          .select([
            'k.id AS id',
            'f.id AS "filialId"',
            'f.title AS "filialTitle"',
            'k."cashCollection" AS price',
            'k."startDate" AS date',
          ])
          .where('k."filialType" = :ft', { ft: 'filial' })
          .andWhere('k."cashCollection" > 0');
        this.applyKassaMonthYearFilter(qb, 'k', month, normalizedYear);
        if (filialId) qb.andWhere('k.filialId = :filialId', { filialId });
        items = await qb.getRawMany();
        break;
      }

      case 'dealer_cash': {
        // Diller naqd: slug=dealer is_online=false — faqat reportga tegishli (child)
        const qb = makeCashflowByDate(['dealer'], 'income');
        qb.andWhere('cash.is_online = false');
        qb.andWhere('r.id IS NOT NULL');
        items = await qb.getMany();
        break;
      }

      case 'dealer_terminal': {
        // Diller o'tkazma: faqat reportga tegishli (child)
        const qb = makeCashflowByDate(['dealer', 'transfer'], 'income');
        qb.andWhere('cash.is_online = true');
        qb.andWhere('r.id IS NOT NULL');
        items = await qb.getMany();
        break;
      }

      case 'kelgan_qarz': {
        // Kelgan qarzlar: slug=qarz,qarzdanKelgan type=Приход
        const qb = makeCashflowByKassa(['debt', 'debt_repayment'], 'income');
        if (filialId) qb.andWhere('k.filialId = :filialId', { filialId });
        items = await qb.getMany();
        break;
      }

      case 'openingBalance': {
        // O'tgan pul: filial saldo + manager/accountant report saldo
        const qb = makeCashflowByKassa(['balance'], 'income');
        if (filialId) qb.andWhere('k.filialId = :filialId', { filialId });
        items = await qb.getMany();
        break;
      }

      case 'boss_income': {
        // Boss prixod: slug=Bos type=Приход
        if (filialId) {
          const qb = makeCashflowQuery(['boss'], 'income');
          this.applyDateRangeFilter(qb, 'k.createdAt', startDate, endDate);
          qb.andWhere('cash.filialId = :filialId', { filialId });
          items = await qb.getMany();
        } else {
          const qb = makeCashflowByDate(['boss'], 'income');
          items = await qb.getMany();
        }
        break;
      }

      case 'kent_income': {
        // Kent prixod: slug=dolg type=Приход (faqat umumiy)
        const qb = makeCashflowByDate(['kent'], 'income');
        items = await qb.getMany();
        break;
      }

      case 'extra_income': {
        // Qo'shimcha prixodlar: slug=prochee type=Приход (faqat umumiy)
        const qb = makeCashflowByDate(['other'], 'income');
        items = await qb.getMany();
        break;
      }

      // ====== TO'Q SARIQ BO'LIM (chiqimlar) ======

      case 'kent_expense': {
        // Kent rasxod: slug=dolg type=Расход (faqat umumiy)
        const qb = makeCashflowByDate(['kent'], 'expense');
        items = await qb.getMany();
        break;
      }

      case 'boss_expense': {
        // Boss rasxod: slug=Bos type=Расход
        if (filialId) {
          const qb = makeCashflowQuery(['boss'], 'expense');
          this.applyDateRangeFilter(qb, 'k.createdAt', startDate, endDate);
          qb.andWhere('cash.filialId = :filialId', { filialId });
          items = await qb.getMany();
        } else {
          const qb = makeCashflowByDate(['boss'], 'expense');
          items = await qb.getMany();
        }
        break;
      }

      case 'business_expense': {
        // Biznes rasxod: bank,kredit,karta,prochee,nalog,Аренда,shop
        const slugs = ['bank', 'credit', 'business', 'other', 'tax', 'rent', 'shop'];
        if (filialId) {
          const qb = makeCashflowByKassa(slugs, 'expense');
          qb.andWhere('k.filialId = :filialId', { filialId });
          items = await qb.getMany();
        } else {
          const qb = makeCashflowByDate(slugs, 'expense');
          items = await qb.getMany();
        }
        break;
      }

      case 'factory': {
        // Taminotchi: slug=factory type=Расход (faqat umumiy)
        const qb = makeCashflowByDate(['factory'], 'expense');
        items = await qb.getMany();
        break;
      }

      case 'logistics': {
        // Logistika: slug=logistika type=Расход (faqat umumiy)
        const qb = makeCashflowByDate(['logistics'], 'expense');
        items = await qb.getMany();
        break;
      }

      case 'tamojniy': {
        // Bojxona: slug=tamojnya type=Расход (faqat umumiy)
        const qb = makeCashflowByDate(['customs'], 'expense');
        items = await qb.getMany();
        break;
      }

      case 'navar_expense': {
        // Navar rasxod: slug=navar type=Расход (faqat filial)
        const qb = makeCashflowQuery(['markup'], 'expense');
        this.applyDateRangeFilter(qb, 'k.createdAt', startDate, endDate);
        if (filialId) qb.andWhere('cash.filialId = :filialId', { filialId });
        items = await qb.getMany();
        break;
      }

      case 'return_orders': {
        // Qaytgan tovarlar — slug=return tipli cashflowlar (kassa ichidagi)
        const qb = makeCashflowByKassa(['return'], 'expense');
        if (filialId) qb.andWhere('k.filialId = :filialId', { filialId });
        items = await qb.getMany();
        break;
      }

      default:
        return { items: [] };
    }

    const result = { items };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 180);
    return result;
  }

// =============================
// ====== HELPERS (modular) ====
// =============================

  private getYearAndDateRange(
    month?: number | string,
    year?: number | string,
  ): { normalizedYear: number; startDate: Date; endDate: Date } {
    const currentYear = dayjs().year();
    const normalizedYear = year ? Number(year) : currentYear;

    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = dayjs(`${normalizedYear}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${normalizedYear}-${month}-01`).endOf('month').toDate();
    } else {
      startDate = dayjs(`${normalizedYear}-01-01`).startOf('year').toDate();
      endDate = dayjs(`${normalizedYear}-12-31`).endOf('year').toDate();
    }

    return { normalizedYear, startDate, endDate };
  }

  /**
   * Kassa month / year bo'yicha filter
   * - month bo'lsa: alias.month = :month AND alias.year = :year
   * - month bo'lmasa: faqat alias.year = :year
   */
  private applyKassaMonthYearFilter(
    qb: any,
    alias: string,
    month: number | string | null | undefined,
    year: number,
  ) {
    if (month) {
      qb.andWhere(`${alias}.month = :month`, { month });
    }
    qb.andWhere(`${alias}.year = :year`, { year });
  }

  /**
   * column BETWEEN :startDate AND :endDate
   */
  private applyDateRangeFilter(
    qb: any,
    column: string,
    startDate: Date,
    endDate: Date,
  ) {
    qb.andWhere(`${column} BETWEEN :startDate AND :endDate`, {
      startDate,
      endDate,
    });
  }

  async calcReport(month, year, type?: 'calc' | 'do') {
    const report = await this.reportRepo.findOne({
      where: {
        year,
        month,
        filialType: FilialType.FILIAL,
      },
    });

    const d_report = await this.reportRepo.findOne({
      where: {
        year,
        month,
        filialType: FilialType.DEALER,
      },
    });

    const [accountant, manager] = await Promise.all([
      this.userRepository.findOne({ where: { isActive: true, position: { role: UserRoleEnum.ACCOUNTANT } } }),
      this.userRepository.findOne({ where: { isActive: true, position: { role: UserRoleEnum.M_MANAGER } } }),
    ]);

    const accountant_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'income' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'expense' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .leftJoin('cash.cashflow_type', 'c_t')
      .where('cash.createdById = :accountant', { accountant: accountant.id })
      .andWhere('cash.reportId = :id', { id: report.id })
      .andWhere('c_t.slug != :type', { type: 'online' });

    const manager_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'income' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'expense' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .leftJoin('cash.cashflow_type', 'c_t')
      .where('cash.createdById = :manager', { manager: manager.id })
      .andWhere('cash.reportId = :id', { id: report.id });

    const data = {
      totalSaleCount: 0,
      totalAdditionalProfitSum: 0,
      totalNetProfitSum: 0,
      totalSaleSize: 0,
      totalPlasticSum: 0,
      totalInternetShopSum: 0,
      totalSale: 0,
      totalSaleReturn: 0,
      totalCashCollection: 0,
      totalDiscountSum: 0,
      totalIncome: 0,
      totalExpense: 0,
      managerSum: 0,
      accountantSum: 0,
      totalDebtCount: 0,
      totalDebtSize: 0,
      totalDebtSum: 0,
      totalDebtProfitSum: 0,
    };

    const f_kassas = await this.kassaRepo.find({ where: { report: { id: report.id } } });
    const d_kassas = await this.kassaRepo.find({ where: { report: { id: d_report.id } } });

    const income_expense = this.cashflowRepository.createQueryBuilder('cash').select(
      `
      SUM(CASE WHEN type = 'income' THEN price ELSE 0 END)::NUMERIC(20, 2) as income,
    SUM(CASE WHEN type = 'expense' THEN price ELSE 0 END)::NUMERIC(20, 2) as expense
      `,
    ).where('cash.reportId = :id', { id: report.id });

    const [{ income, expense }, manager_result, accountant_result] = await Promise.all([
      income_expense.getRawOne(),
      manager_qb.getRawOne(),
      accountant_qb.getRawOne(),
    ]);

    data.totalIncome = income ?? 0;
    data.totalExpense = expense ?? 0;
    data.accountantSum = (Number(accountant_result?.total_income) || 0) - (Number(accountant_result?.total_expense) || 0);
    data.managerSum = (Number(manager_result?.total_income) || 0) - (Number(manager_result?.total_expense) || 0);

    for (const k of f_kassas) {
      data.totalSaleCount += k.saleCount;
      data.totalAdditionalProfitSum += k.additionalProfitSum;
      data.totalNetProfitSum += k.netProfitSum;
      data.totalSaleSize += k.saleSize;
      data.totalPlasticSum += k.plasticSum;
      data.totalSale += k.sale;
      data.totalSaleReturn += k.saleReturn;
      data.totalCashCollection += k.cashCollection;
      data.totalDiscountSum += k.discountSum;
      data.accountantSum += k.plasticSum;
      data.totalDebtCount += k.debtCount || 0;
      data.totalDebtSize += k.debtSize || 0;
      data.totalDebtSum += k.debtSum || 0;
      data.totalDebtProfitSum += k.debtProfitSum || 0;
    }

    for (const k of d_kassas) {
      data.totalSaleCount += k.saleCount || 0;
      data.totalNetProfitSum += k.debtProfitSum || 0;
      data.totalSaleSize += k.debtSize || 0;
      data.totalPlasticSum += k.plasticSum || 0;
      data.totalSale += k.sale || 0;
      data.totalSaleReturn += k.saleReturn || 0;
      data.totalCashCollection += k.cashCollection || 0;
      data.totalDiscountSum += k.discountSum || 0;
      data.accountantSum += k.plasticSum || 0;
      data.totalDebtCount += k.debtCount || 0;
      data.totalDebtSize += k.debtSize || 0;
      data.totalDebtSum += k.debtSum || 0;
      data.totalDebtProfitSum += k.debtProfitSum || 0;
    }

    if (type === 'do') {
      await this.reportRepo.update({ id: report.id }, data);

      return { data, message: 'fixed data' };
    }

    return { data, message: 'calced data', report, d_report };
  }

  /**
   * Filial bo'yicha barcha Report larning yig'indisi (Ежемесячный отчет yuqori qismi).
   */
  async getReportTotalsByFilial(filialId: string) {
    const reports = await this.reportRepo.find({
      where: { filial: { id: filialId } },
    });

    if (!reports.length) return {};

    return reports.reduce(
      (acc, r) => ({
        totalIncome: +(acc.totalIncome + (r.totalIncome || 0)).toFixed(2),
        totalSale: +(acc.totalSale + (r.totalSale || 0)).toFixed(2),
        totalPlasticSum: +(acc.totalPlasticSum + (r.totalPlasticSum || 0)).toFixed(2),
        totalAdditionalProfitSum: +(acc.totalAdditionalProfitSum + (r.totalAdditionalProfitSum || 0)).toFixed(2),
        totalExpense: +(acc.totalExpense + (r.totalExpense || 0)).toFixed(2),
        totalSaleReturn: +(acc.totalSaleReturn + (r.totalSaleReturn || 0)).toFixed(2),
        totalCashCollection: +(acc.totalCashCollection + (r.totalCashCollection || 0)).toFixed(2),
        totalDiscountSum: +(acc.totalDiscountSum + (r.totalDiscountSum || 0)).toFixed(2),
        totalSaleSize: +(acc.totalSaleSize + (r.totalSaleSize || 0)).toFixed(2),
        totalDebtSum: +(acc.totalDebtSum + (r.totalDebtSum || 0)).toFixed(2),
        totalNetProfitSum: +(acc.totalNetProfitSum + (r.totalNetProfitSum || 0)).toFixed(2),
      }),
      {
        totalIncome: 0, totalSale: 0, totalPlasticSum: 0,
        totalAdditionalProfitSum: 0, totalExpense: 0, totalSaleReturn: 0,
        totalCashCollection: 0, totalDiscountSum: 0,
        totalSaleSize: 0, totalDebtSum: 0, totalNetProfitSum: 0,
      },
    );
  }

  /**
   * Dealer kassa detail — merged list of package entries (Расход) and
   * payment entries (Приход), sorted by date and paginated.
   * Follows the same pattern as factory detail report.
   */
  async getDealerKassaDetail(dealerId: string, dto: { year?: number; month?: number; page?: number; limit?: number }) {
    const year = dto.year || dayjs().year();
    const month = dto.month || null;
    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const dealer = await this.filialRepository.findOne({ where: { id: dealerId } });
    if (!dealer) throw new NotFoundException('Dealer not found');

    let startDate: Date;
    let endDate: Date;
    if (month) {
      startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();
    } else {
      startDate = dayjs(`${year}-01-01`).startOf('year').toDate();
      endDate = dayjs(`${year}-12-31`).endOf('year').toDate();
    }

    // Source A: Package entries (Расход) — accepted packages for this dealer
    const rawPackageEntries = await this.entityManager.query(`
      SELECT
        pt.id AS package_id,
        pt."acceptedAt" AS date,
        pt.title,
        pt.total_sum AS total_cost,
        pt.total_kv,
        pt.total_count,
        col.title AS collection_title,
        pcp."dealerPriceMeter" AS price_per_kv,
        COALESCE(SUM(t.kv), 0)::NUMERIC(20,2) AS col_kv,
        (COALESCE(SUM(t.kv), 0) * pcp."dealerPriceMeter")::NUMERIC(20,2) AS col_cost
      FROM package_transfer pt
      JOIN "package-collection-price" pcp ON pcp."packageId" = pt.id
      JOIN collection col ON pcp."collectionId" = col.id
      LEFT JOIN transfer t ON t."packageId" = pt.id
        AND t.progres = 'Accepted'
        AND EXISTS (
          SELECT 1 FROM product p
          JOIN qrbase qb ON p."barCodeId" = qb.id
          WHERE p.id = t."productId" AND qb."collectionId" = col.id
        )
      WHERE pt."dealerId" = $1
        AND pt.status = 'accepted'
        AND pt."acceptedAt" BETWEEN $2 AND $3
      GROUP BY pt.id, pt."acceptedAt", pt.title, pt.total_sum, pt.total_kv, pt.total_count,
               col.title, pcp."dealerPriceMeter"
      HAVING COALESCE(SUM(t.kv), 0) > 0
      ORDER BY pt."acceptedAt" ASC
    `, [dealerId, startDate, endDate]);

    // Group collections by package
    const packageMap = new Map<string, any>();
    for (const entry of rawPackageEntries) {
      const key = entry.package_id;
      if (!packageMap.has(key)) {
        packageMap.set(key, {
          id: entry.package_id,
          entry_type: 'package',
          date: entry.date,
          title: entry.title || 'Пакет',
          total_kv: Number(entry.total_kv || 0),
          total_cost: Number(entry.total_cost || 0),
          total_count: Number(entry.total_count || 0),
          collections: [],
        });
      }
      const group = packageMap.get(key);
      if (entry.collection_title) {
        group.collections.push({
          collection_title: entry.collection_title,
          price_per_kv: Number(entry.price_per_kv || 0),
          total_kv: Number(entry.col_kv || 0),
          total_cost: Number(entry.col_cost || 0),
        });
      }
    }
    const packageEntries = Array.from(packageMap.values());

    // Source B: Payment entries (Приход cashflows in dealer kassa)
    const paymentEntries = await this.entityManager.query(`
      SELECT
        c.id,
        'payment' AS entry_type,
        c.date,
        c.price AS total_cost,
        c.comment,
        c.is_online,
        u."firstName" || ' ' || u."lastName" AS who_paid
      FROM cashflow c
      LEFT JOIN users u ON c."createdById" = u.id
      JOIN kassa k ON c."kassaId" = k.id
      WHERE k."filialId" = $1
        AND c.type = 'income'
        AND c.isCancelled = false
        AND c.date BETWEEN $2 AND $3
      ORDER BY c.date ASC
    `, [dealerId, startDate, endDate]);

    // Merge and sort by date
    const allEntries = [
      ...packageEntries,
      ...paymentEntries.map((e: any) => ({
        ...e,
        total_cost: Number(e.total_cost || 0),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Paginate
    const totalItems = allEntries.length;
    const offset = (page - 1) * limit;
    const paginatedItems = allEntries.slice(offset, offset + limit);

    // Totals for period
    const totalOwed = packageEntries.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
    const totalGiven = paymentEntries.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);

    return {
      items: paginatedItems,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        itemCount: limit,
      },
      totals: {
        period_owed: Number(totalOwed.toFixed(2)),
        period_given: Number(totalGiven.toFixed(2)),
        period_balance: Number((totalOwed - totalGiven).toFixed(2)),
      },
      dealer: {
        id: dealer.id,
        title: dealer.title,
        owed: dealer.owed,
        given: dealer.given,
        balance: Number(((dealer.owed || 0) - (dealer.given || 0)).toFixed(2)),
      },
    };
  }

  /**
   * Dealer report list — all dealers with cumulative and period data.
   */
  async getDealerReport(dto: { year?: number; month?: number; search?: string; page?: number; limit?: number }) {
    try {
      const year = Number(dto.year) || dayjs().year();
      const month = Number(dto.month) || (dayjs().month() + 1);
      const page = Number(dto.page) || 1;
      const limit = Number(dto.limit) || 50;
      const offset = (page - 1) * limit;
      const search = dto.search || null;

      const startDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
      const endDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').toDate();

      // Step 1: Get dealers list
      let dealerQuery = `
        SELECT f.id, f.title,
          COALESCE(f.owed, 0)::NUMERIC(20,2) AS owed,
          COALESCE(f.given, 0)::NUMERIC(20,2) AS given
        FROM filial f
        WHERE f.type = 'dealer' AND f."isActive" = true
      `;
      const dealerParams: any[] = [];
      if (search) {
        dealerParams.push(`%${search}%`);
        dealerQuery += ` AND f.title ILIKE $1`;
      }
      dealerQuery += ` ORDER BY f.title ASC`;

      const allDealers = await this.entityManager.query(dealerQuery, dealerParams);
      const totalItems = allDealers.length;
      const paginatedDealers = allDealers.slice(offset, offset + limit);

      if (paginatedDealers.length === 0) {
        return {
          items: [],
          meta: { totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit), itemCount: 0 },
          totals: { total_owed: 0, total_given: 0, total_debt: 0, total_period_owed: 0, total_period_given: 0 },
        };
      }

      // Step 2: Get period data for paginated dealers
      const dealerIds = paginatedDealers.map((d: any) => d.id);

      const periodOwedResult = await this.entityManager.query(`
        SELECT pt."dealerId" AS dealer_id, COALESCE(SUM(pt.total_sum), 0)::NUMERIC(20,2) AS period_owed
        FROM package_transfer pt
        WHERE pt."dealerId" = ANY($1)
          AND pt.status = 'accepted'
          AND pt."acceptedAt" BETWEEN $2 AND $3
        GROUP BY pt."dealerId"
      `, [dealerIds, startDate, endDate]);

      const periodGivenResult = await this.entityManager.query(`
        SELECT k."filialId" AS dealer_id, COALESCE(SUM(c.price), 0)::NUMERIC(20,2) AS period_given
        FROM cashflow c
        JOIN kassa k ON c."kassaId" = k.id
        WHERE k."filialId" = ANY($1)
          AND c.type = 'income'
          AND c.isCancelled = false
          AND c.date BETWEEN $2 AND $3
        GROUP BY k."filialId"
      `, [dealerIds, startDate, endDate]);

      const owedMap = new Map(periodOwedResult.map((r: any) => [r.dealer_id, Number(r.period_owed)]));
      const givenMap = new Map(periodGivenResult.map((r: any) => [r.dealer_id, Number(r.period_given)]));

      const items = paginatedDealers.map((d: any) => ({
        id: d.id,
        title: d.title,
        owed: Number(d.owed),
        given: Number(d.given),
        totalDebt: Number((Number(d.owed) - Number(d.given)).toFixed(2)),
        period_owed: owedMap.get(d.id) || 0,
        period_given: givenMap.get(d.id) || 0,
      }));

      // Step 3: Totals across ALL dealers (not just paginated)
      const allIds = allDealers.map((d: any) => d.id);

      const totalOwedGiven = allDealers.reduce((acc: any, d: any) => {
        acc.owed += Number(d.owed);
        acc.given += Number(d.given);
        return acc;
      }, { owed: 0, given: 0 });

      const totalPeriodOwed = await this.entityManager.query(`
        SELECT COALESCE(SUM(pt.total_sum), 0)::NUMERIC(20,2) AS total
        FROM package_transfer pt
        WHERE pt."dealerId" = ANY($1)
          AND pt.status = 'accepted'
          AND pt."acceptedAt" BETWEEN $2 AND $3
      `, [allIds, startDate, endDate]);

      const totalPeriodGiven = await this.entityManager.query(`
        SELECT COALESCE(SUM(c.price), 0)::NUMERIC(20,2) AS total
        FROM cashflow c
        JOIN kassa k ON c."kassaId" = k.id
        WHERE k."filialId" = ANY($1)
          AND c.type = 'income'
          AND c.isCancelled = false
          AND c.date BETWEEN $2 AND $3
      `, [allIds, startDate, endDate]);

      return {
        items,
        meta: {
          totalItems,
          currentPage: page,
          totalPages: Math.ceil(totalItems / limit),
          itemCount: items.length,
        },
        totals: {
          total_owed: Number(totalOwedGiven.owed.toFixed(2)),
          total_given: Number(totalOwedGiven.given.toFixed(2)),
          total_debt: Number((totalOwedGiven.owed - totalOwedGiven.given).toFixed(2)),
          total_period_owed: Number(totalPeriodOwed[0]?.total || 0),
          total_period_given: Number(totalPeriodGiven[0]?.total || 0),
        },
      };
    } catch (error) {
      console.error('getDealerReport error:', error);
      throw error;
    }
  }

  /**
   * Get collection details for a specific package transfer.
   * Used when clicking on a Расход entry to see breakdown.
   */
  async getPackageCollections(packageId: string) {
    const pkg = await this.packageTransfer.findOne({
      where: { id: packageId },
      relations: { collection_prices: { collection: true } },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    // For each collection price, calculate actual kv from accepted transfers
    const results = await this.entityManager.query(`
      SELECT
        col.title AS collection_title,
        pcp."dealerPriceMeter" AS price_per_kv,
        COALESCE(SUM(t.kv), 0)::NUMERIC(20,2) AS total_kv,
        (COALESCE(SUM(t.kv), 0) * pcp."dealerPriceMeter")::NUMERIC(20,2) AS total_cost
      FROM "package-collection-price" pcp
      JOIN collection col ON pcp."collectionId" = col.id
      LEFT JOIN transfer t ON t."packageId" = $1
        AND t.progres = 'Accepted'
        AND EXISTS (
          SELECT 1 FROM product p
          JOIN qrbase qb ON p."barCodeId" = qb.id
          WHERE p.id = t."productId" AND qb."collectionId" = col.id
        )
      WHERE pcp."packageId" = $1
      GROUP BY col.title, pcp."dealerPriceMeter"
      HAVING COALESCE(SUM(t.kv), 0) > 0
      ORDER BY col.title
    `, [packageId]);

    return {
      package_id: pkg.id,
      title: pkg.title,
      total_sum: pkg.total_sum,
      total_kv: pkg.total_kv,
      total_count: pkg.total_count,
      collections: results.map((r: any) => ({
        collection_title: r.collection_title,
        price_per_kv: Number(r.price_per_kv || 0),
        total_kv: Number(r.total_kv || 0),
        total_cost: Number(r.total_cost || 0),
      })),
    };
  }
}

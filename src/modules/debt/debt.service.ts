import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Debt } from './debt.entity';
import { CashflowService } from '../cashflow/cashflow.service';
import { CashFlowEnum } from 'src/infra/shared/enum';
import CashflowTipEnum from 'src/infra/shared/enum/cashflow/cashflow-tip.enum';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import DebtTransactionTypeEnum from 'src/infra/shared/enum/debt-type-enum';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { CashflowTypeService } from '../cashflow-type/cashflow-type.service';
import { DebtTransactionDto } from './dto/amount-debt-dto';

@Injectable()
export class DebtService {
  constructor(
    @InjectRepository(Debt)
    private readonly debtRepository: Repository<Debt>,
    private readonly connection: DataSource,
    @Inject(forwardRef(() => CashflowService))
    private readonly cashflowService: CashflowService,
    @Inject(forwardRef(() => CashflowTypeService))
    private readonly cashflowTypeService: CashflowTypeService,
  ) {}

  async findAll(options: IPaginationOptions): Promise<Pagination<Debt>> {
    const queryBuilder = this.debtRepository.createQueryBuilder('debt');
    return paginate<Debt>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Debt> {
    const debt = await this.debtRepository.findOne({ where: { id } });
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }
    return debt;
  }

  async create(dto: CreateDebtDto): Promise<Debt> {
    const debt = this.debtRepository.create(dto);
    return this.debtRepository.save(debt);
  }

  async update(id: string, dto: UpdateDebtDto): Promise<Debt> {
    const debt = await this.findOne(id);
    Object.assign(debt, dto);
    return this.debtRepository.save(debt);
  }

  async remove(id: string): Promise<{ message: string }> {
    const debt = await this.findOne(id);
    await this.debtRepository.remove(debt);
    return { message: 'Debt successfully deleted' };
  }

  async getDebtBalance(id: string): Promise<{ balance: number }> {
    const debt = await this.findOne(id);
    const balance = debt.owed - debt.given;
    return { balance };
  }

  async handleTransaction(dto: DebtTransactionDto, userId: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const debt = await this.findOne(dto.debtId);

      const cashflowTypeId = await this.cashflowTypeService.getDebtTypeId();

      // CashflowService orqali operatsiyani amalga oshirish
      await this.cashflowService.create(
        {
          type: dto.transactionType === DebtTransactionTypeEnum.TAKE ? CashFlowEnum.InCome : CashFlowEnum.Consumption,
          price: dto.amount,
          comment: dto.comment,
          kassa: dto.kassaId,
          cashflow_type: cashflowTypeId,
          debtId: debt.id,
          tip: CashflowTipEnum.DEBT,
          title: 'debt',
          casher: userId,
          order: null,
          report: null,
        },
        userId,
      );

      // Debt ma'lumotlarini yangilash (after given/owed are updated)
      const updatedDebt = await this.findOne(dto.debtId);
      updatedDebt.totalDebt = updatedDebt.given - updatedDebt.owed;
      if (updatedDebt.totalDebt < 0) updatedDebt.totalDebt = 0;

      await this.debtRepository.save(updatedDebt);

      await queryRunner.commitTransaction();
      return { message: 'Transaction completed', debt: updatedDebt };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getNextNumber(): Promise<number> {
    const last = await this.debtRepository.findOne({
      order: { number_debt: 'DESC' },
    });

    return (last?.number_debt ?? 0) + 1;
  }
}

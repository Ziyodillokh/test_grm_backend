import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PlanYear } from './plan-year.entity';
import { UpdatePlanYearDto } from './dto/update-plan-year.dto';
import CreatePlanYearDto from './dto/create-plan-year.dto';
import * as dayjs from 'dayjs';
import { Cashflow } from '../cashflow/cashflow.entity';
import PlanYearType from 'src/infra/shared/enum/plan-year.enum';
import FilialType from 'src/infra/shared/enum/filial-type.enum';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { UserRoleEnum } from 'src/infra/shared/enum';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { SellerReport } from '../seller-report/seller-report.entity';
import { FilialPlanService } from '@modules/filial-plan/filial-plan.service';

@Injectable()
export class PlanYearService {
  constructor(
    @InjectRepository(PlanYear)
    private readonly repo: Repository<PlanYear>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    private readonly entityManager: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SellerReportItem)
    private readonly sellerReportItemRepository: Repository<SellerReportItem>,
    @InjectRepository(SellerReport)
    private readonly sellerReportRepository: Repository<SellerReport>,
    private readonly filialPlanService: FilialPlanService,
  ) {}

  async create(dto: CreatePlanYearDto): Promise<PlanYear> {
    const year = dayjs().year();
    const day = dayjs().dayOfYear();
    const status = 2;
    const plan = this.repo.create({
      year,
      day,
      collectedAmount: 0,
      status,
      type: PlanYearType.PLANYEAR,
      ...dto,
    });

    return this.repo.save(plan);
  }

  async findAll(): Promise<PlanYear[]> {
    const qb = this.repo
      .createQueryBuilder('plan')
      .where('plan.type = :type', { type: PlanYearType.PLANYEAR })
      .orderBy('plan.year', 'DESC');

    return qb.getMany();
  }

  async findOne(id: string): Promise<PlanYear> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async update(id: string, dto: UpdatePlanYearDto): Promise<PlanYear> {
    return await this.entityManager.transaction(async (manager) => {
      const plan = await manager.findOne(PlanYear, {
        where: { id },
        relations: ['filial', 'user'],
      });

      if (!plan) throw new NotFoundException('Plan not found');

      const oldGoal = plan.yearlyGoal;
      const newGoal = dto.yearlyGoal ?? oldGoal;
      const goalDifference = newGoal - oldGoal;

      // Plan ma'lumotlarini yangilash
      Object.assign(plan, dto);
      const updatedPlan = await manager.save(plan);

      // Agar yearlyGoal o'zgarmagan bo'lsa, propagation qilmaslik
      if (goalDifference === 0) {
        return updatedPlan;
      }

      // Planlar ierarxiyasini yangilash
      await this.propagateChanges(manager, plan, goalDifference);

      return updatedPlan;
    });
  }

  // 🔄 O'zgarishlarni barcha darajalarga tarqatish
  private async propagateChanges(manager: EntityManager, updatedPlan: PlanYear, goalDifference: number): Promise<void> {
    switch (updatedPlan.type) {
      case PlanYearType.PLANYEAR:
        // Global plan o'zgardi → Filiallarga proporsional tarqatish
        await this.redistributeToFilials(manager, updatedPlan.year, updatedPlan.yearlyGoal);
        break;

      case PlanYearType.FILIAL:
        // Filial plan o'zgardi → Yuqoriga (Global) va pastga (Sellerlar) ta'sir
        await this.updateGlobalFromFilials(manager, updatedPlan.year);
        await this.redistributeToSellers(manager, updatedPlan.filial.id, updatedPlan.year, updatedPlan.yearlyGoal);
        break;

      case PlanYearType.USER:
        // Seller plan o'zgardi → Yuqoriga (Filial va Global) ta'sir
        await this.updateFilialFromSellers(manager, updatedPlan.filial.id, updatedPlan.year);
        await this.updateGlobalFromFilials(manager, updatedPlan.year);
        break;
    }
  }

  // 🔄 Global planni filiallarga proporsional tarqatish
  private async redistributeToFilials(manager: EntityManager, year: number, newGlobalGoal: number): Promise<void> {
    const filialPlans = await manager.find(PlanYear, {
      where: { year, type: PlanYearType.FILIAL },
      relations: ['filial'],
    });

    if (filialPlans.length === 0) return;

    const currentTotalGoal = filialPlans.reduce((sum, plan) => sum + (plan.yearlyGoal || 0), 0);

    if (currentTotalGoal === 0) {
      // Teng taqsimlash
      const equalShare = newGlobalGoal / filialPlans.length;
      filialPlans.forEach((plan) => {
        plan.yearlyGoal = Number(equalShare.toFixed(2));
      });
    } else {
      // Proporsional taqsimlash
      filialPlans.forEach((plan) => {
        const proportion = (plan.yearlyGoal || 0) / currentTotalGoal;
        plan.yearlyGoal = Number((newGlobalGoal * proportion).toFixed(2));
      });
    }

    await manager.save(filialPlans);

    // Har bir filial uchun sellerlarni ham yangilash
    for (const filialPlan of filialPlans) {
      await this.redistributeToSellers(manager, filialPlan.filial.id, year, filialPlan.yearlyGoal);
    }
  }

  // 🔄 Filial planini sellerlarga proporsional tarqatish
  private async redistributeToSellers(
    manager: EntityManager,
    filialId: string,
    year: number,
    newFilialGoal: number,
  ): Promise<void> {
    const sellerPlans = await manager.find(PlanYear, {
      where: {
        year,
        type: PlanYearType.USER,
        filial: { id: filialId },
      },
      relations: ['filial', 'user'],
    });

    if (sellerPlans.length === 0) return;

    const currentTotalSellerGoal = sellerPlans.reduce((sum, plan) => sum + (plan.yearlyGoal || 0), 0);

    if (currentTotalSellerGoal === 0) {
      // Teng taqsimlash
      const equalShare = newFilialGoal / sellerPlans.length;
      sellerPlans.forEach((plan) => {
        plan.yearlyGoal = Number(equalShare.toFixed(2));
      });
    } else {
      // Proporsional taqsimlash
      sellerPlans.forEach((plan) => {
        const proportion = (plan.yearlyGoal || 0) / currentTotalSellerGoal;
        plan.yearlyGoal = Number((newFilialGoal * proportion).toFixed(2));
      });
    }

    await manager.save(sellerPlans);
  }

  // 🔄 Sellerlar o'zgarishiga asoslanib filial planini yangilash
  private async updateFilialFromSellers(manager: EntityManager, filialId: string, year: number): Promise<void> {
    const sellerPlans = await manager.find(PlanYear, {
      where: {
        year,
        type: PlanYearType.USER,
        filial: { id: filialId },
      },
    });

    const totalSellerGoal = sellerPlans.reduce((sum, plan) => sum + (plan.yearlyGoal || 0), 0);

    const filialPlan = await manager.findOne(PlanYear, {
      where: {
        year,
        type: PlanYearType.FILIAL,
        filial: { id: filialId },
      },
    });

    if (filialPlan) {
      filialPlan.yearlyGoal = totalSellerGoal;
      await manager.save(filialPlan);
    }
  }

  // 🔄 Filiallar o'zgarishiga asoslanib global planini yangilash
  private async updateGlobalFromFilials(manager: EntityManager, year: number): Promise<void> {
    const filialPlans = await manager.find(PlanYear, {
      where: { year, type: PlanYearType.FILIAL },
    });

    const totalFilialGoal = filialPlans.reduce((sum, plan) => sum + (plan.yearlyGoal || 0), 0);

    const globalPlan = await manager.findOne(PlanYear, {
      where: { year, type: PlanYearType.PLANYEAR },
    });

    if (globalPlan) {
      globalPlan.yearlyGoal = totalFilialGoal;
      await manager.save(globalPlan);
    }
  }

  // 🔥 YANGI: Cascading CollectedAmount Update System
  // Seller ReportItem qo'shilganda chaqiriladi
  async updateSellerCollectedAmount(sellerId: string, year?: number): Promise<void> {
    const currentYear = year || dayjs().year();

    // 1. Seller uchun SellerReportItem lar yig'indisini hisoblash
    const totalSellSum = await this.sellerReportItemRepository
      .createQueryBuilder('item')
      .select('SUM(item.totalSellPrice)', 'sum')
      .where('item.user.id = :sellerId', { sellerId })
      .andWhere('YEAR(item.date) = :year', { year: currentYear })
      .getRawOne();

    const sellerCollectedAmount = Number(totalSellSum?.sum) || 0;

    // 2. Seller PlanYear ni yangilash
    const sellerPlan = await this.repo.findOne({
      where: {
        year: currentYear,
        type: PlanYearType.USER,
        user: { id: sellerId },
      },
      relations: ['user', 'filial'],
    });

    if (!sellerPlan) return;

    const oldSellerAmount = sellerPlan.collectedAmount || 0;
    sellerPlan.collectedAmount = sellerCollectedAmount;
    await this.repo.save(sellerPlan);

    // 3. Cascading update: Filial va Global ni yangilash
    const difference = sellerCollectedAmount - oldSellerAmount;
    if (difference !== 0) {
      await this.cascadeCollectedAmountUpdate(sellerPlan.filial.id, currentYear, difference);
    }
  }

  // Filial va Global CollectedAmount ni cascade yangilash
  private async cascadeCollectedAmountUpdate(filialId: string, year: number, difference: number): Promise<void> {
    await this.entityManager.transaction(async (manager) => {
      // 1. Filial PlanYear ni yangilash
      const filialPlan = await manager.findOne(PlanYear, {
        where: {
          year,
          type: PlanYearType.FILIAL,
          filial: { id: filialId },
        },
      });

      if (filialPlan) {
        filialPlan.collectedAmount = (filialPlan.collectedAmount || 0) + difference;
        await manager.save(filialPlan);

        // 2. Global PlanYear ni yangilash
        const globalPlan = await manager.findOne(PlanYear, {
          where: { year, type: PlanYearType.PLANYEAR },
        });

        if (globalPlan) {
          globalPlan.collectedAmount = (globalPlan.collectedAmount || 0) + difference;
          await manager.save(globalPlan);
        }
      }
    });
  }

  // 🔥 YANGI: Barcha CollectedAmount larni to'g'ri hisoblash
  async recalculateAllCollectedAmounts(year?: number): Promise<{
    sellersUpdated: number;
    filialsUpdated: number;
    globalUpdated: boolean;
  }> {
    const currentYear = year || dayjs().year();
    let sellersUpdated = 0;
    let filialsUpdated = 0;
    let globalUpdated = false;

    await this.entityManager.transaction(async (manager) => {
      // 1. Sellerlar uchun to'g'ri collectedAmount hisoblash
      const sellerPlans = await manager.find(PlanYear, {
        where: {
          year: currentYear,
          type: PlanYearType.USER,
        },
        relations: ['user', 'filial'],
      });

      for (const sellerPlan of sellerPlans) {
        if (!sellerPlan.user) continue;
        const totalSellSum = await this.sellerReportItemRepository
          .createQueryBuilder('item')
          .select('SUM(item.totalSellPrice)', 'sum')
          .where('item.user.id = :sellerId', { sellerId: sellerPlan.user?.id })
          .andWhere('EXTRACT(YEAR FROM item.date) = :year', { year: currentYear })
          .getRawOne();

        const newAmount = Number(totalSellSum?.sum) || 0;

        if (sellerPlan.collectedAmount !== newAmount) {
          sellerPlan.collectedAmount = newAmount;
          await manager.save(sellerPlan);
          sellersUpdated++;
        }
      }

      // 2. Filiallar uchun sellerlar yig'indisini hisoblash
      const filialPlans = await manager.find(PlanYear, {
        where: {
          year: currentYear,
          type: PlanYearType.FILIAL,
        },
        relations: ['filial'],
      });

      for (const filialPlan of filialPlans) {
        const filialSellerPlans = await manager.find(PlanYear, {
          where: {
            year: currentYear,
            type: PlanYearType.USER,
            filial: { id: filialPlan.filial.id },
          },
        });

        const filialTotal = filialSellerPlans.reduce((sum, plan) => sum + (plan.collectedAmount || 0), 0);

        if (filialPlan.collectedAmount !== filialTotal) {
          filialPlan.collectedAmount = filialTotal;
          await manager.save(filialPlan);
          filialsUpdated++;
        }
      }

      // 3. Global plan uchun filiallar yig'indisini hisoblash
      const globalPlan = await manager.findOne(PlanYear, {
        where: { year: currentYear, type: PlanYearType.PLANYEAR },
      });

      if (globalPlan) {
        const globalTotal = filialPlans.reduce((sum, plan) => sum + (plan.collectedAmount || 0), 0);

        if (globalPlan.collectedAmount !== globalTotal) {
          globalPlan.collectedAmount = globalTotal;
          await manager.save(globalPlan);
          globalUpdated = true;
        }
      }
    });

    return { sellersUpdated, filialsUpdated, globalUpdated };
  }

  async remove(id: string): Promise<void> {
    const plan = await this.findOne(id);
    await this.repo.softRemove(plan);
  }

  async restore(id: string): Promise<void> {
    const plan = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    await this.repo.restore(id);
  }

  async getPlanPerformance(): Promise<{
    dailyPlan: number;
    dailyCollected: number;
    performancePercent: number;
    gapPercent: number;
    trend: string;
    message: string;
  }> {
    const year = dayjs().year();
    const currentDay = dayjs().dayOfYear();

    const { totals: { plan_price, earn } } = await this.filialPlanService.getByYear(year, 1, 1);

    const totalDays = dayjs(`${year}-12-31`).dayOfYear();
    const dailyPlan = plan_price / totalDays;
    const dailyCollected = earn / currentDay;
    const performancePercent = (dailyCollected / dailyPlan) * 100;
    const gapPercent = 100 - performancePercent;

    const trend = dailyCollected >= dailyPlan ? 'O‘sish' : 'Tushish';
    const diffPercent = Math.abs(performancePercent - 100).toFixed(2);
    const message = `${trend}: rejalashtirilganga nisbatan ${diffPercent}% ${trend.toLowerCase()}`;

    return {
      dailyPlan: +dailyPlan.toFixed(2),
      dailyCollected: +dailyCollected.toFixed(2),
      performancePercent: +performancePercent.toFixed(2),
      gapPercent: +gapPercent.toFixed(2),
      trend,
      message,
    };
  }

  async recalculateCollectedAmount() {
    console.warn('recalculateCollectedAmount deprecated. Use recalculateAllCollectedAmounts instead.');
    await this.recalculateAllCollectedAmounts();
  }

  async calculateMonthlyProgress(year?: number, month?: number) {
    const now = dayjs();
    const currentYear = year ?? now.year();
    const currentMonth = month ?? now.month() + 1;

    const currentDay =
      currentYear === now.year() && currentMonth === now.month() + 1
        ? now.date()
        : dayjs(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`).daysInMonth();

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevDays = dayjs(`${prevYear}-${String(prevMonth).padStart(2, '0')}-01`).daysInMonth();

    const curReports = await this.sellerReportRepository.find({
      where: { year: currentYear, month: currentMonth },
    });
    const prevReports = await this.sellerReportRepository.find({
      where: { year: prevYear, month: prevMonth },
    });

    const curTotal = curReports.reduce((sum, r) => sum + Number(r.totalSellPrice ?? 0), 0);
    const prevTotal = prevReports.reduce((sum, r) => sum + Number(r.totalSellPrice ?? 0), 0);

    const curAvg = currentDay > 0 ? curTotal / currentDay : 0;
    const prevAvg = prevDays > 0 ? prevTotal / prevDays : 0;

    const difference = curAvg - prevAvg;
    const percent = prevAvg === 0 ? 100 : (difference / prevAvg) * 100;
    const trend = difference >= 0 ? 'O‘sish' : 'Tushish';
    return {
      trend,
      percent: percent.toFixed(2),
      message: `${trend}: bu oy kunlik o'rtacha ${Math.abs(percent).toFixed(2)}% ga ${trend.toLowerCase()}`,
      details: {
        currentMonthAvg: curAvg.toFixed(2),
        previousMonthAvg: prevAvg.toFixed(2),
        currentTotalSell: curTotal.toFixed(2),
        previousTotalSell: prevTotal.toFixed(2),
      },
    };
  }

  async createForAllFilials(): Promise<{ created: number; updated: number }> {
    const year = dayjs().year();

    const globalPlan = await this.repo.findOne({
      where: { year, type: PlanYearType.PLANYEAR },
    });

    const globalGoal = globalPlan?.yearlyGoal || 0;

    const filials = await this.filialRepository.find({
      where: { type: FilialType.FILIAL },
    });

    const existing = await this.repo.find({
      where: {
        year,
        type: PlanYearType.FILIAL,
      },
      relations: ['filial'],
    });

    // CollectedAmount ni yangi sistemaga moslash
    const collectedAmounts = new Map<string, number>();
    existing.forEach((plan) => {
      if (plan.filial?.id) {
        collectedAmounts.set(plan.filial.id, plan.collectedAmount || 0);
      }
    });

    if (existing.length > 0) {
      await this.repo.remove(existing);
    }

    const newEntities: PlanYear[] = [];
    const perFilialGoal = filials.length > 0 ? Number((globalGoal / filials.length).toFixed(2)) : 0;
    const day = dayjs().dayOfYear();

    for (const filial of filials) {
      const previousCollectedAmount = collectedAmounts.get(filial.id) || 0;

      const entity = this.repo.create({
        year,
        yearlyGoal: perFilialGoal,
        collectedAmount: previousCollectedAmount,
        day,
        type: PlanYearType.FILIAL,
        filial,
      });

      newEntities.push(entity);
    }

    await this.repo.save(newEntities);

    return {
      created: newEntities.length,
      updated: existing.length,
    };
  }

  async getAllFilialPlans(
    year?: number,
    options?: IPaginationOptions,
  ): Promise<Pagination<PlanYear> & { totals: any }> {
    const qb = this.repo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.filial', 'filial')
      .where('plan.type = :type', { type: PlanYearType.FILIAL });

    if (year) {
      qb.andWhere('plan.year = :year', { year });
    }

    qb.orderBy('filial.name', 'ASC').addOrderBy('plan.year', 'DESC');

    // 📌 1) Pagination natijasini olamiz
    let pagination = await paginate<PlanYear>(qb, options);

    // 📌 2) Totallarni alohida query orqali hisoblaymiz
    const totals = await this.repo
      .createQueryBuilder('plan')
      .select([
        'SUM(plan.yearlyGoal)::NUMERIC(20, 2) as "totalYearlyGoal"',
        'SUM(plan.collectedAmount)::NUMERIC(20, 2) as "totalCollectedAmount"',
      ])
      .where('plan.type = :type', { type: PlanYearType.FILIAL })
      .andWhere(year ? 'plan.year = :year' : '1=1', { year })
      .getRawOne();

    // 📌 3) Natijaga totals qo‘shib qaytaramiz
    return {
      items: pagination.items,
      meta: pagination.meta,
      totals: {
        totalYearlyGoal: Number(totals.totalYearlyGoal || 0),
        totalCollectedAmount: Number(totals.totalCollectedAmount || 0),
      },
    };
  }

  async getTotalFilialsPlans(year) {
    const totals = await this.repo
      .createQueryBuilder('plan')
      .select([
        'SUM(plan.yearlyGoal)::NUMERIC(20, 2) as "totalYearlyGoal"',
        'SUM(plan.collectedAmount)::NUMERIC(20, 2) as "totalCollectedAmount"',
      ])
      .where('plan.type = :type', { type: PlanYearType.FILIAL })
      .andWhere(year ? 'plan.year = :year' : '1=1', { year })
      .getRawOne();

    return {
      totalYearlyGoal: Number(totals.totalYearlyGoal || 0),
      totalCollectedAmount: Number(totals.totalCollectedAmount || 0),
    };
  }

  async getTotalUsersPlans(year){
    const totals = await this.repo
      .createQueryBuilder('plan')
      .select([
        'SUM(plan.yearlyGoal)::NUMERIC(20, 2) as "totalYearlyGoal"',
        'SUM(plan.collectedAmount)::NUMERIC(20, 2) as "totalCollectedAmount"',
      ])
      .leftJoin('plan.filial', 'filial')
      .where('plan.type = :type', { type: PlanYearType.USER })
      .andWhere(year ? 'plan.year = :year' : '1=1', { year })
      .getRawOne();

    return {
      totalYearlyGoal: Number(totals.totalYearlyGoal || 0),
      totalCollectedAmount: Number(totals.totalCollectedAmount || 0),
    };
  }


  async getFilialPlans(filialId: string, year?: number): Promise<PlanYear[]> {
    const qb = this.repo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.filial', 'filial')
      .where('plan.type = :type', { type: PlanYearType.FILIAL })
      .andWhere('filial.id = :filialId', { filialId });

    if (year) {
      qb.andWhere('plan.year = :year', { year });
    }

    qb.orderBy('plan.year', 'DESC');

    return qb.getMany();
  }

  async getById(id: string): Promise<PlanYear> {
    const plan = await this.repo.findOne({
      where: { id },
      relations: ['filial'],
    });

    if (!plan) throw new NotFoundException('PlanYear not found');

    return plan;
  }

  async deleteById(id: string): Promise<{ deleted: boolean }> {
    const result = await this.repo.softDelete(id);

    if (result.affected === 0) {
      throw new NotFoundException('PlanYear not found');
    }

    return { deleted: true };
  }

  async restoreById(id: string): Promise<{ restored: boolean }> {
    const result = await this.repo.restore(id);

    if (result.affected === 0) {
      throw new NotFoundException('PlanYear not found');
    }

    return { restored: true };
  }
  async createPlanForSingleSeller(sellerId: string): Promise<{ created: boolean; message: string }> {
    const year = dayjs().year();

    // Seller ma'lumotlarini olish
    const seller = await this.userRepository.findOne({
      where: { id: sellerId },
      relations: ['position', 'filial'],
    });

    if (!seller) {
      return { created: false, message: 'Seller topilmadi' };
    }

    if (seller.position.role !== UserRoleEnum.SELLER) {
      return { created: false, message: 'Foydalanuvchi seller emas' };
    }

    if (!seller.filial) {
      return { created: false, message: 'Sellerga filial biriktirilmagan' };
    }

    // Allaqachon plan bor yoki yo'qligini tekshirish
    const existingPlan = await this.repo.findOne({
      where: {
        year,
        type: PlanYearType.USER,
        user: { id: sellerId },
      },
    });

    if (existingPlan) {
      return { created: false, message: 'Seller uchun plan allaqachon mavjud' };
    }

    return await this.entityManager.transaction(async (manager) => {
      // Filial planini topish yoki yaratish
      let filialPlan = await manager.findOne(PlanYear, {
        where: {
          year,
          type: PlanYearType.FILIAL,
          filial: { id: seller.filial.id },
        },
        relations: ['filial'],
      });

      if (!filialPlan) {
        filialPlan = manager.create(PlanYear, {
          year,
          type: PlanYearType.FILIAL,
          filial: seller.filial,
          yearlyGoal: 0,
          collectedAmount: 0,
          day: dayjs().dayOfYear(),
        });
        await manager.save(filialPlan);
      }

      // Filialda mavjud sellerlar sonini hisoblash
      const existingSellerPlans = await manager.find(PlanYear, {
        where: {
          year,
          type: PlanYearType.USER,
          filial: { id: seller.filial.id },
        },
      });

      const totalSellers = existingSellerPlans.length + 1; // +1 yangi seller uchun

      // Agar filial goalini teng taqsimlash kerak bo'lsa
      let sellerGoal = 0;
      if (filialPlan.yearlyGoal > 0) {
        sellerGoal = Number((filialPlan.yearlyGoal / totalSellers).toFixed(2));

        // Mavjud sellerlarning goalini qayta taqsimlash
        for (const existingPlan of existingSellerPlans) {
          existingPlan.yearlyGoal = sellerGoal;
          await manager.save(existingPlan);
        }
      }

      // Yangi seller uchun plan yaratish
      const newSellerPlan = manager.create(PlanYear, {
        year,
        type: PlanYearType.USER,
        user: seller,
        filial: seller.filial,
        yearlyGoal: sellerGoal,
        collectedAmount: 0,
        day: dayjs().dayOfYear(),
      });

      await manager.save(newSellerPlan);

      return { created: true, message: 'Seller uchun plan muvaffaqiyatli yaratildi' };
    });
  }

  // createSellerPlansForFilial metodini ham yangilash kerak
  async createSellerPlansForFilial(filialId: string): Promise<{ created: number }> {
    const year = dayjs().year();
    let created = 0;

    const filial = await this.filialRepository.findOne({
      where: { id: filialId },
    });
    if (!filial) throw new NotFoundException('Filial topilmadi');

    const sellers = await this.userRepository.find({
      where: {
        filial: { id: filial.id },
        position: { role: UserRoleEnum.SELLER },
      },
      relations: ['position', 'filial'],
    });

    if (sellers.length === 0) return { created: 0 };

    return await this.entityManager.transaction(async (manager) => {
      // Filial planini topish yoki yaratish
      let filialPlan = await manager.findOne(PlanYear, {
        where: {
          year,
          type: PlanYearType.FILIAL,
          filial: { id: filial.id },
        },
        relations: ['filial'],
      });

      if (!filialPlan) {
        filialPlan = manager.create(PlanYear, {
          year,
          type: PlanYearType.FILIAL,
          filial,
          yearlyGoal: 0,
          collectedAmount: 0,
          day: dayjs().dayOfYear(),
        });
        await manager.save(filialPlan);
      }

      // Mavjud seller planlarini tekshirish
      const existingSellerPlans = await manager.find(PlanYear, {
        where: {
          year,
          type: PlanYearType.USER,
          filial: { id: filial.id },
        },
        relations: ['user'],
      });

      const existingUserIds = existingSellerPlans.map((p) => p.user?.id);
      const newSellers = sellers.filter((s) => !existingUserIds.includes(s.id));

      if (newSellers.length === 0) return { created: 0 };

      // Goalini taqsimlash
      const totalSellers = existingSellerPlans.length + newSellers.length;
      const perSellerGoal =
        totalSellers > 0 && filialPlan.yearlyGoal > 0 ? Number((filialPlan.yearlyGoal / totalSellers).toFixed(2)) : 0;

      // Mavjud sellerlar goalini yangilash
      for (const existingPlan of existingSellerPlans) {
        existingPlan.yearlyGoal = perSellerGoal;
        await manager.save(existingPlan);
      }

      // Yangi sellerlar uchun plan yaratish
      for (const seller of newSellers) {
        const plan = manager.create(PlanYear, {
          year,
          type: PlanYearType.USER,
          user: seller,
          filial,
          yearlyGoal: perSellerGoal,
          collectedAmount: 0,
          day: dayjs().dayOfYear(),
        });
        await manager.save(plan);
        created++;
      }

      return { created };
    });
  }

  async createForAllSellers(): Promise<{ created: number }> {
    const year = dayjs().year();
    const filials = await this.filialRepository.find({ where: { type: FilialType.FILIAL } });

    let created = 0;

    for (const filial of filials) {
      const result = await this.createSellerPlansForFilial(filial.id);
      created += result.created;
    }

    return { created };
  }

  async getAllSellers(
    filialId?: string,
    options?: IPaginationOptions,
    year?: number,
  ) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .select([
        `user.id`,
        `user.firstName`,
        `user.lastName`,
        `user.fatherName`,
      ])
      .addSelect([
        `position.id`,
        `position.title`,
        `position.role`,
      ])
      .leftJoin('user.position', 'position')
      .addSelect([
        `filial.id`,
        `filial.title`,
        `filial.name`,

      ])
      .leftJoin('user.filial', 'filial')
      .addSelect([
        `avatar.id`,
        `avatar.path`,
        `avatar.mimetype`,
      ])
      .leftJoin('user.avatar', 'avatar')
      .addSelect([
        `planYear.id`,
        `planYear.year`,
        `planYear.type`,
        `planYear.collectedAmount`,
      ])
      .leftJoin(
        'user.planYear',
        'planYear',
        year ? 'planYear.year = :year' : '1=1',
        { year },
      )
      .where('position.role = :role', { role: UserRoleEnum.SELLER });

    if (filialId) {
      qb.andWhere('filial.id = :filialId', { filialId });
    }

    qb.orderBy('filial.name', 'ASC');

    const totalsQb = this.repo
      .createQueryBuilder('plan')
      .select([
        'SUM(plan.yearlyGoal)::NUMERIC(20, 2) as "totalYearlyGoal"',
        'SUM(plan.collectedAmount)::NUMERIC(20, 2) as "totalCollectedAmount"',
      ])
      .leftJoin('plan.filial', 'filial')
      .where('plan.type = :type', { type: PlanYearType.USER })
      .andWhere(year ? 'plan.year = :year' : '1=1', { year });

    if (filialId) {
      totalsQb.andWhere('filial.id = :filialId', { filialId });
    }

    const [pagination, totals] = await Promise.all([
      paginate<any>(qb, options),
      totalsQb.getRawOne(),
    ]);

    return {
      data: pagination.items,
      meta: pagination.meta,
      totals: {
        totalYearlyGoal: Number(totals.totalYearlyGoal || 0),
        totalCollectedAmount: Number(totals.totalCollectedAmount || 0),
      },
    };
  }

  async redistributeSellerPlan(userId: string): Promise<boolean> {
    const year = dayjs().year();

    const userPlan = await this.repo.findOne({
      where: {
        year,
        type: PlanYearType.USER,
        user: { id: userId },
      },
      relations: ['user', 'filial'],
    });

    if (!userPlan) return false;

    // Yangi logika: yearlyGoal - collectedAmount
    const remaining = userPlan.yearlyGoal - userPlan.collectedAmount;

    if (remaining > 0) {
      // Musbat chiqsa - filialning yearlyGoal dan ayirish kerak

      // Filialning planini topish
      const filialPlan = await this.repo.findOne({
        where: {
          year,
          type: PlanYearType.FILIAL,
          filial: { id: userPlan.filial.id },
        },
      });

      if (filialPlan) {
        // Filial planidan qolgan miqdorni ayirish
        filialPlan.yearlyGoal = Math.max(0, filialPlan.yearlyGoal - remaining);
        await this.repo.save(filialPlan);
      }

      // Yillik planini ham kamaytirish
      const yearlyPlan = await this.repo.findOne({
        where: {
          year,
          type: PlanYearType.PLANYEAR,
        },
      });

      if (yearlyPlan) {
        yearlyPlan.yearlyGoal = Math.max(0, yearlyPlan.yearlyGoal - remaining);
        await this.repo.save(yearlyPlan);
      }
    }

    // Chiqayotgan sellerning planini 0 ga o'rnatish
    userPlan.yearlyGoal = 0;
    await this.repo.save(userPlan);

    return true;
  }

  async createPlanForNewFilial(filialId: string): Promise<{ created: boolean; message: string }> {
    const year = dayjs().year();

    // Filial ma'lumotlarini olish
    const filial = await this.filialRepository.findOne({
      where: { id: filialId, type: FilialType.FILIAL },
    });

    if (!filial) {
      return { created: false, message: "Filial topilmadi yoki turi noto'g'ri" };
    }

    // Allaqachon plan bor yoki yo'qligini tekshirish
    const existingPlan = await this.repo.findOne({
      where: {
        year,
        type: PlanYearType.FILIAL,
        filial: { id: filialId },
      },
    });

    if (existingPlan) {
      return { created: false, message: 'Filial uchun plan allaqachon mavjud' };
    }

    return await this.entityManager.transaction(async (manager) => {
      // Global planini topish
      let globalPlan = await manager.findOne(PlanYear, {
        where: { year, type: PlanYearType.PLANYEAR },
      });

      if (!globalPlan) {
        // Agar global plan yo'q bo'lsa, yaratish
        globalPlan = manager.create(PlanYear, {
          year,
          type: PlanYearType.PLANYEAR,
          yearlyGoal: 0,
          collectedAmount: 0,
          day: dayjs().dayOfYear(),
          status: 2,
        });
        await manager.save(globalPlan);
      }

      // Barcha mavjud filial planlarini olish
      const existingFilialPlans = await manager.find(PlanYear, {
        where: { year, type: PlanYearType.FILIAL },
        relations: ['filial'],
      });

      const totalFilials = existingFilialPlans.length + 1; // +1 yangi filial uchun

      // Global goalini barcha filiallarga qayta taqsimlash
      let filialGoal = 0;
      if (globalPlan.yearlyGoal > 0) {
        filialGoal = Number((globalPlan.yearlyGoal / totalFilials).toFixed(2));

        // Mavjud filiallar goalini yangilash
        for (const existingPlan of existingFilialPlans) {
          existingPlan.yearlyGoal = filialGoal;
          await manager.save(existingPlan);

          // Har bir filial uchun sellerlarga ham qayta taqsimlash
          await this.redistributeToSellers(manager, existingPlan.filial.id, year, filialGoal);
        }
      }

      // Yangi filial uchun plan yaratish
      const newFilialPlan = manager.create(PlanYear, {
        year,
        type: PlanYearType.FILIAL,
        filial,
        yearlyGoal: filialGoal,
        collectedAmount: 0,
        day: dayjs().dayOfYear(),
        status: 2,
      });

      await manager.save(newFilialPlan);

      return { created: true, message: 'Filial uchun plan muvaffaqiyatli yaratildi' };
    });
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollItems } from './payroll-items.entity';
import { CreatePayrollItemDto, FilterPayrollItemDto, UpdatePayrollItemDto } from './dto';
import { UserService } from '../user/user.service';
import { AwardService } from '../award/award.service';
import { Payroll } from '../payroll/payroll.entity';
import { BonusService } from '../bonus/bonus.service';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import OperatorType from 'src/infra/shared/enum/forbonus/operator-type';
import ConditionUnit from 'src/infra/shared/enum/forbonus/condition-type';
import { SellerReportService } from '../seller-report/seller-report.service';
import BonusType from 'src/infra/shared/enum/forbonus/bonus-type';

@Injectable()
export class PayrollItemsService {
  constructor(
    @InjectRepository(PayrollItems)
    private readonly payrollItemsRepo: Repository<PayrollItems>,

    @InjectRepository(Payroll)
    private readonly payrollRepo: Repository<Payroll>, // Payroll uchun alohida repo

    private readonly userService: UserService,
    private readonly awardService: AwardService,
    private readonly bonusService: BonusService,
    private readonly sellerReportService: SellerReportService, // Agar kerak bo'lsa, seller report service
  ) {}

  async create(dto: CreatePayrollItemDto) {
    const { payrollId, userId, selectedMonth, year = new Date().getFullYear() } = dto;

    const user = await this.userService.getOne(userId);
    if (!user) throw new BadRequestException(`Пользователь не найден, ID: ${userId}`);
    const salary = user.salary || 0;

    const total = salary;

    const payrollItem = this.payrollItemsRepo.create({
      total,
      selectedMonth,
      year: year || new Date().getFullYear(),
      payroll: { id: payrollId },
      user: { id: userId },
    });

    const savedItem = await this.payrollItemsRepo.save(payrollItem);
    return savedItem;
  }

  async recalculatePayroll(payrollId: string) {
    const payrollItems = await this.payrollItemsRepo.find({
      where: { payroll: { id: payrollId } },
      relations: ['award', 'bonus', 'user'],
    });

    let totalSum = 0;
    let totalPlastic = 0;
    let totalInHand = 0;
    let totalAward = 0;
    let totalPrepayment = 0;
    let totalBonus = 0;

    for (const item of payrollItems) {
      const salary = item.user?.salary || 0;
      const awardSum = item.award ? item.award.sum : 0;
      const prepayment = item.prepayment || 0;

      let bonusAmount = 0;

      if (item.bonus) {
        try {
          const bonusEntity = item.bonus;
          const selectedMonth = item.selectedMonth;
          const year = item.year || new Date().getFullYear();

          const sellerReport = await this.sellerReportService.findByUserAndPeriod(item.user.id, selectedMonth, year);

          if (sellerReport && bonusEntity.condition) {
            let conditionMet = false;
            let baseValue = 0;
            let userValue = 0;

            switch (bonusEntity.conditionUnit) {
              case ConditionUnit.SQUARE_METER:
                userValue = sellerReport.totalSellKv || 0;
                baseValue = sellerReport.totalSellPrice || 0;
                break;
              case ConditionUnit.PIECE:
                userValue = sellerReport.totalSellCount || 0;
                baseValue = sellerReport.totalSellPrice || 0;
                break;
              default:
                break;
            }

            switch (bonusEntity.operator) {
              case OperatorType.EQUAL:
                conditionMet = userValue === bonusEntity.condition;
                break;
              case OperatorType.GREATER_THAN:
                conditionMet = userValue > bonusEntity.condition;
                break;
              case OperatorType.GREATER_THAN_OR_EQUAL:
                conditionMet = userValue >= bonusEntity.condition;
                break;
              default:
                break;
            }

            if (conditionMet) {
              switch (bonusEntity.bonusUnit) {
                case BonusType.DOLLAR:
                  bonusAmount = bonusEntity.bonusAmount || 0;
                  break;
                case BonusType.PERCENT:
                  bonusAmount = (baseValue * (bonusEntity.bonusAmount || 0)) / 100;
                  break;
                default:
                  bonusAmount = 0;
                  break;
              }
            } else {
              bonusAmount = 0;
            }
          } else {
            bonusAmount = 0;
          }
        } catch (error) {
          bonusAmount = 0;
        }
      }

      const itemTotal = salary + prepayment + awardSum + bonusAmount;

      totalSum += itemTotal;
      totalPlastic += item.plastic || 0;
      totalInHand += item.inHand || 0;
      totalAward += awardSum;
      totalPrepayment += prepayment;
      totalBonus += bonusAmount;
    }

    await this.payrollRepo.update(payrollId, {
      total: totalSum,
      plastic: totalPlastic,
      inHand: totalInHand,
      award: totalAward,
      prepayment: totalPrepayment,
      bonus: totalBonus,
    });
  }

  async findAll(filter: FilterPayrollItemDto & IPaginationOptions) {
    const qb = this.payrollItemsRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.user', 'user')
      .leftJoinAndSelect('user.filial', 'filial')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('item.payroll', 'payroll')
      .leftJoinAndSelect('item.award', 'award')
      .leftJoinAndSelect('item.bonus', 'bonus');

    if (filter.payrollId) {
      qb.andWhere('payroll.id = :payrollId', { payrollId: filter.payrollId });
    }
    if (filter.filialId) {
      qb.andWhere('filial.id = :filialId', { filialId: filter.filialId });
    }

    return paginate<PayrollItems>(qb, {
      page: filter.page || 1,
      limit: filter.limit || 10,
      route: '', //  frontga kerak bo'lsa to‘liq API yo'li
    });
  }

  findOne(id: string) {
    return this.payrollItemsRepo.findOne({
      where: { id },
      relations: ['user.avatar', 'payroll', 'award', 'bonus'],
    });
  }

  async update(id: string, dto: UpdatePayrollItemDto) {
    const existing = await this.payrollItemsRepo.findOne({
      where: { id },
      relations: ['award', 'bonus', 'user', 'payroll'],
    });

    if (!existing) return null;

    let { prepayment, award, bonus, user } = existing;
    let salary = user?.salary || 0;
    let awardSum = 0;
    let bonusAmount = 0;

    const selectedMonth = dto.selectedMonth ?? existing.selectedMonth;
    const year = dto.year ?? existing.year;

    const updateData: Partial<PayrollItems> = {};

    if (dto.awardId && dto.is_premium === true) {
      try {
        const newAward = await this.awardService.findOne(dto.awardId);
        updateData.award = newAward;
        updateData.is_premium = true;
        awardSum = newAward.sum || 0;
      } catch (error) {
        console.warn(`Award topilmadi, ID: ${dto.awardId}`);
        updateData.award = null;
        awardSum = 0;
      }
    } else if (dto.awardId === null || dto.is_premium === false) {
      updateData.award = null;
      awardSum = 0;
    } else if (award) {
      awardSum = award.sum || 0;
    }

    if (dto.bonusId && dto.is_bonus === true) {
      try {
        const bonusEntity = await this.bonusService.findOne(dto.bonusId);
        updateData.bonus = bonusEntity;
        updateData.is_bonus = true;
        const sellerReport = await this.sellerReportService.findByUserAndPeriod(user.id, selectedMonth, year);

        if (sellerReport && bonusEntity.condition) {
          let conditionMet = false;
          let baseValue = 0;

          let userValue = 0;

          switch (bonusEntity.conditionUnit) {
            case ConditionUnit.SQUARE_METER:
              userValue = sellerReport.totalSellKv || 0;
              baseValue = sellerReport.totalSellPrice || 0;
              break;
            case ConditionUnit.PIECE:
              userValue = sellerReport.totalSellCount || 0;
              baseValue = sellerReport.totalSellPrice || 0;
              break;
            default:
              console.warn(`Noma'lum condition unit: ${bonusEntity.conditionUnit}`);
              break;
          }

          switch (bonusEntity.operator) {
            case OperatorType.EQUAL:
              conditionMet = userValue === bonusEntity.condition;
              break;
            case OperatorType.GREATER_THAN:
              conditionMet = userValue > bonusEntity.condition;
              break;
            case OperatorType.GREATER_THAN_OR_EQUAL:
              conditionMet = userValue >= bonusEntity.condition;
              break;
            default:
              console.warn(`Noma'lum operator: ${bonusEntity.operator}`);
              break;
          }

          if (conditionMet) {
            switch (bonusEntity.bonusUnit) {
              case BonusType.DOLLAR:
                bonusAmount = bonusEntity.bonusAmount || 0;
                break;
              case BonusType.PERCENT:
                bonusAmount = (baseValue * (bonusEntity.bonusAmount || 0)) / 100;
                break;
              default:
                console.warn(`Noma'lum bonus type: ${bonusEntity.bonusUnit}`);
                bonusAmount = 0;
                break;
            }
          } else {
            bonusAmount = 0;
            console.log(
              `User ${user.id} bonus shartini bajarmadi. Talab: ${bonusEntity.condition} ${bonusEntity.conditionUnit}, Haqiqiy: ${userValue}`,
            );
          }
        } else {
          bonusAmount = 0;
          if (!sellerReport) {
            console.warn(`Seller report topilmadi user ${user.id} uchun ${selectedMonth}/${year} davr`);
          }
        }
      } catch (error) {
        console.warn(`Bonus hisoblashda xatolik, ID: ${dto.bonusId}`, error);
        updateData.bonus = null;
        bonusAmount = 0;
      }
    } else if (dto.bonusId === null || dto.is_bonus === false) {
      updateData.bonus = null;
      bonusAmount = 0;
    } else if (bonus) {
      try {
        const sellerReport = await this.sellerReportService.findByUserAndPeriod(user.id, selectedMonth, year);

        if (sellerReport && bonus.condition) {
          let conditionMet = false;
          let baseValue = 0;
          let userValue = 0;

          switch (bonus.conditionUnit) {
            case ConditionUnit.SQUARE_METER:
              userValue = sellerReport.totalSellKv || 0;
              baseValue = sellerReport.totalSellPrice || 0;
              break;
            case ConditionUnit.PIECE:
              userValue = sellerReport.totalSellCount || 0;
              baseValue = sellerReport.totalSellPrice || 0;
              break;
          }

          switch (bonus.operator) {
            case OperatorType.EQUAL:
              conditionMet = userValue === bonus.condition;
              break;
            case OperatorType.GREATER_THAN:
              conditionMet = userValue > bonus.condition;
              break;
            case OperatorType.GREATER_THAN_OR_EQUAL:
              conditionMet = userValue >= bonus.condition;
              break;
          }

          if (conditionMet) {
            switch (bonus.bonusUnit) {
              case BonusType.DOLLAR:
                bonusAmount = bonus.bonusAmount || 0;
                break;
              case BonusType.PERCENT:
                bonusAmount = (baseValue * (bonus.bonusAmount || 0)) / 100;
                break;
              default:
                bonusAmount = 0;
                break;
            }
          } else {
            bonusAmount = 0;
          }
        } else {
          bonusAmount = 0;
        }
      } catch (error) {
        console.warn(`Mavjud bonus qayta hisoblashda xatolik`, error);
        bonusAmount = 0;
      }
    }

    if (dto.prepayment !== undefined) {
      prepayment = dto.prepayment;
      updateData.prepayment = dto.prepayment;
    }

    if (dto.selectedMonth !== undefined) {
      updateData.selectedMonth = dto.selectedMonth;
    }

    if (dto.year !== undefined) {
      updateData.year = dto.year;
    }

    if (dto.salary !== undefined) {
      salary = dto.salary;
      await this.userService.change({ salary: dto.salary }, user.id);
    }

    const inHand = dto.inHand ?? existing.inHand;
    const plastic = dto.plastic ?? existing.plastic;

    const total = salary + (prepayment || 0) + awardSum + bonusAmount;

    // Tekshirish: total = inHand + plastic
    if (Math.abs(total - (inHand + plastic)) > 0.01) {
      // Float xatoliklarini hisobga olish
      throw new BadRequestException(`Сумма не равна общей сумме! Total: ${total}, In hand: ${inHand}, Plastic: ${plastic}`);
    }

    updateData.inHand = inHand;
    updateData.plastic = plastic;
    updateData.total = total;

    const updated = this.payrollItemsRepo.merge(existing, updateData);
    const saved = await this.payrollItemsRepo.save(updated);

    await this.recalculatePayroll(existing.payroll.id);

    console.log(
      `Payroll yangilandi: User ${user.id}, Salary: ${salary}, Award: ${awardSum}, Bonus: ${bonusAmount}, Total: ${total}, Month: ${selectedMonth}/${year}`,
    );

    return saved;
  }

  async remove(id: string) {
    const item = await this.payrollItemsRepo.findOne({
      where: { id },
      relations: ['award', 'bonus', 'user', 'payroll'],
    });

    await this.payrollItemsRepo.remove(item);

    await this.recalculatePayroll(item.payroll.id);

    return item;
  }
}

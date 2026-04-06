import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { packageTransferCodeGenerator } from '../../infra/helpers';
import { Filial } from '@modules/filial/filial.entity';
import { User } from '@modules/user/user.entity';
import PaginationDto from '@infra/shared/dto/pagination.dto';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import packageTransferEnum from '@infra/shared/enum/package-transfer.enum';
import PackageTransferEnum from '@infra/shared/enum/package-transfer.enum';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import { CashFlowEnum } from '@infra/shared/enum';
import CashflowTipEnum from '@infra/shared/enum/cashflow/cashflow-tip.enum';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import * as dayjs from 'dayjs';

@Injectable()
export class PackageTransferService {
  constructor(
    @InjectRepository(PackageTransfer)
    private readonly repository: Repository<PackageTransfer>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>
  ) {
  }

  async getAll(query: PaginationDto & { dealer?: string; filial?: string, search?: string }) {
    const { page, limit, dealer, filial, search } = query;

    const queryBuilder = this.repository
      .createQueryBuilder('package_transfer')
      .leftJoinAndSelect('package_transfer.dealer', 'dealer')
      .leftJoinAndSelect('package_transfer.from', 'from')
      .leftJoinAndSelect('package_transfer.d_manager', 'd_manager')
      .leftJoinAndSelect('package_transfer.courier', 'courier')
      .orderBy('package_transfer.createdAt', 'DESC');

    // ✅ Filtering
    if (dealer) {
      queryBuilder.andWhere('dealer.id = :dealer', { dealer });
    }

    if (filial) {
      queryBuilder.andWhere('from.id = :filial', { filial });
    }

    if (filial) {
      queryBuilder.andWhere('from.title = :search', { search });
    }

    const options: IPaginationOptions = {
      page,
      limit,
      route: '', // optional: set if you want route-based pagination links
    };

    return paginate<PackageTransfer>(queryBuilder, options);
  }

  async getById(id: string) {
    return await this.repository
      .findOne({
        where: { id },
        relations: {
          from: true,
          dealer: true,
          courier: true,
        },
      })
      .catch(() => {
        throw new NotFoundException('data not found');
      });
  }

  async findOrCreate(dealer: Filial, user: User | { filial }, courier: string): Promise<string> {
    const filial = user.filial;
    let package_transfer = await this.repository.findOne({
      where: {
        dealer: { id: dealer.id },
        status: PackageTransferEnum.Progress,
      },
    });
    if (!package_transfer) {
      const data = {
        from: filial.id,
        dealer: dealer.id,
        courier,
        title: 'TR-' + packageTransferCodeGenerator(),
        d_manager: dealer.manager.id,
      };
      const pck_tr = this.repository.create(data as unknown as PackageTransfer);
      const res = await this.repository.save(pck_tr);
      return res.id;
    }

    return package_transfer.id;
  }

  async bulkCreateTransfers({ count, kv, price, netProfitSum, package_transfer }) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        total_count: () => `total_count + ${count}`,
        total_kv: () => `total_kv + ${kv}`,
        total_sum: () => `total_sum + ${price}`,
        total_profit_sum: () => `total_profit_sum + ${netProfitSum}`,
      })
      .where('id = :id', { id: package_transfer })
      .execute();
  }

  async bulkRemoveTransfers({ count, kv, price, netProfitSum, package_transfer }) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        total_count: () => `total_count - ${count}`,
        total_kv: () => `total_kv - ${kv}`,
        total_sum: () => `total_sum - ${price}`,
        total_profit_sum: () => `total_profit_sum - ${netProfitSum}`,
      })
      .where('id = :id', { id: package_transfer })
      .execute();
  }

  async updateTotalSums({ totalSum, package_transfer, netProfitSum }) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        total_sum: totalSum,
        total_profit_sum: netProfitSum,
      })
      .where('id = :id', { id: package_transfer })
      .execute();
  }

  async changeStatus(id, status: packageTransferEnum) {
    if (status === PackageTransferEnum.Accept) {
      const packageTransfer = await this.repository.findOne({
        where: { id },
        relations: { dealer: true, from: true, d_manager: true },
      });

      if (packageTransfer && packageTransfer.status !== PackageTransferEnum.Accept) {
        const cashflowType = await this.cashflowTypeRepository.findOne({
          where: { slug: 'dealer' },
        });

        if (cashflowType) {
          const cashflow = new Cashflow();
          cashflow.price = packageTransfer.total_profit_sum;
          cashflow.type = CashFlowEnum.Consumption;
          cashflow.tip = CashflowTipEnum.CASHFLOW;
          cashflow.filial = packageTransfer.from;
          cashflow.cashflow_type = cashflowType;
          cashflow.comment = `${packageTransfer.dealer.title} qarz oldi: ${packageTransfer.total_profit_sum}, ${packageTransfer.total_kv} m²`;
          cashflow.date = new Date();
          cashflow.is_static = true;
          cashflow.createdBy = packageTransfer.d_manager;

          const year = dayjs().year();
          const month = dayjs().month() + 1;

          const kassa = await this.kassaRepository.findOne({
            where: {
              filial: { id: packageTransfer.from.id },
              year,
              month,
            },
          });

          if (kassa) {
            cashflow.kassa = kassa;
          }

          await this.cashflowRepository.save(cashflow);
        }
      }
    }
    await this.repository.update({ id }, { status });
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CashflowType } from './cashflow-type.entity';
import { CreateCashflowTypeDto, UpdateCashflowTypeDto } from './dto';
import { UserRoleEnum } from '../../infra/shared/enum';
import CashflowTypeEnum from '../../infra/shared/enum/cashflow/cashflow-type.enum';
import { User } from '@modules/user/user.entity';

@Injectable()
export class CashflowTypeService {
  constructor(
    @InjectRepository(CashflowType)
    private readonly repository: Repository<CashflowType>, // private readonly cashflowService: CashflowService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getAll(type: CashflowTypeEnum, user) {
    return await this.repository.find({
      order: { title: 'ASC' },
      relations: { positions: true, icon: true },
      where: {
        positions: {
          id: user.position.id,
        },
        type: In([CashflowTypeEnum.BOTH, type]),
      },
    });
  }

  async getOne(id: string) {
    return await this.repository.findOne({
      where: { id },
    });
  }

  async getOneBySlug(slug: string) {
    return await this.repository
      .findOne({
        where: { slug },
      })
      .catch(() => {
        throw new NotFoundException('Cashflow type not found');
      });
  }

  async deleteOne(id: string) {
    return await this.repository.softDelete(id).catch(() => {
      throw new NotFoundException('Cashflow not found');
    });
  }

  async restore(id: string) {
    return await this.repository.restore(id).catch(() => {
      throw new NotFoundException('Cashflow not found');
    });
  }

  async change(value: UpdateCashflowTypeDto, id: string) {
    const { positions, ...rest } = value;

    // Step 1: Update only if primitive fields exist
    if (Object.keys(rest).length > 0) {
      await this.repository.update({ id }, rest as unknown as CashflowType);
    }

    // Step 2: Update many-to-many relation
    if (positions) {
      const entity = await this.repository.findOne({
        where: { id },
        relations: ['positions'],
      });

      if (!entity) {
        throw new Error('CashflowType not found');
      }

      entity.positions = positions.map((p) => ({ id: p.id })) as any;

      await this.repository.save(entity);
    }

    // Step 3: Return updated entity
    return this.repository.findOne({
      where: { id },
      relations: ['positions'],
    });
  }

  async create(value: CreateCashflowTypeDto) {
    const data = this.repository.create(value as any as CashflowType);
    return await this.repository.save(data);
  }

  async getDebtTypeId(): Promise<string> {
    const entity = await this.repository.findOne({
      where: { slug: 'Долг' },
    });

    if (!entity) {
      throw new NotFoundException('Cashflow type for "Долг" not found');
    }

    return entity.id;
  }

  async getForSeller(type: CashflowTypeEnum) {
    return await this.repository.find({
      where: {
        ...(type && { type: In([CashflowTypeEnum.BOTH, type]) }),
        positions: {
          role: UserRoleEnum.F_MANAGER,
        },
      },
      relations: {
        icon: true,
      },
    });
  }

  async getById(type: CashflowTypeEnum, user_id: string) {
    let user;

    user_id !== 'both' && (user = await this.userRepository.findOne({
      where: { id: user_id },
      relations: { position: true },
    }));

    const cashflows = await this.repository.find({
      where: {
        ...(type && { type: In([CashflowTypeEnum.BOTH, type]) }),
        positions: {
          role: user_id !== 'both' ? user.position.role : In([UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT]),
        },
      },
      relations: {
        icon: true,
      },
    });

    cashflows.push(await this.getOneBySlug('delaer'));
    cashflows.push(await this.getOneBySlug('kassa'));
    cashflows.push(await this.getOneBySlug('онлайн'));

    return cashflows;
  }

  async getForFilialManager(type: CashflowTypeEnum) {
    return await this.repository.find({
      where: {
        type: In([CashflowTypeEnum.BOTH, type]),
        positions: {
          role: UserRoleEnum.F_MANAGER,
        },
      },
      relations: {
        icon: true,
      },
    });
  }
}

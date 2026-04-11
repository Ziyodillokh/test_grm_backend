import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { Partiya } from './partiya.entity';
import { CreatePartiyaDto, UpdatePartiyaDto } from './dto';
import { partiyaDateSort } from '../../infra/helpers';
import { Not, Repository } from 'typeorm';
import { ActionService } from '../action/action.service';
import { FilialTypeEnum, PartiyaStatusEnum, ProductReportEnum, UserRoleEnum } from '../../infra/shared/enum';
import { PartiyaStatusService } from '../partiya-status/partiya-status.service';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { ExcelService } from '../excel/excel.service';

@Injectable()
export class PartiyaService {
  constructor(
    @InjectRepository(Partiya)
    private readonly partiyaRepository: Repository<Partiya>,
    private readonly actionService: ActionService,
    private readonly partiyaStatusService: PartiyaStatusService,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @Inject(forwardRef(() => ExcelService))
    private readonly excelProductService: ExcelService,
  ) {}

  async getAll(options: IPaginationOptions, where, user): Promise<Pagination<Partiya>> {
    if (user?.filial?.type === FilialTypeEnum.WAREHOUSE) {
      where.partiya_status = Not(PartiyaStatusEnum.NEW);
    }
    return await paginate<Partiya>(this.partiyaRepository, options, {
      relations: {
        factory: true,
        partiya_no: true,
        country: true,
        warehouse: true,
      },
      order: { date: 'DESC' },
      where,
    });
  }

  async getAllByDateRange() {
    const data = await this.partiyaRepository.find({ order: { date: 'DESC' } });
    return partiyaDateSort(data);
  }

  async getOne(id: string) {
    return await this.partiyaRepository
      .findOne({
        where: { id },
        relations: { warehouse: true, country: true, factory: true, user: true, partiya_no: true },
      })
      .catch(() => {
        throw new NotFoundException('Partiya not found!');
      });
  }

  async deleteOne(id: string) {
    const data = await this.partiyaRepository
      .findOne({
        where: { id },
        relations: {},
      })
      .catch(() => {
        throw new NotFoundException('Partiya not found');
      });

    // deleteFile(data?.excel?.path);

    return await this.partiyaRepository.delete(id);
  }

  async change(value: UpdatePartiyaDto, id: string) {
    const partiya = await this.partiyaRepository.findOne({ where: { id } });
    value = { volume: partiya.volume, expense: partiya.expense, ...value };
    value.expensePerKv = value.expense / value.volume;

    return await this.partiyaRepository.update({ id }, value as unknown as Partiya);
  }

  async finish(id) {
    return await this.partiyaRepository.update({ id }, { partiya_status: PartiyaStatusEnum.FINISHED });
  }

  async changeExp(value, id: string, user) {
    const partiya = await this.partiyaRepository.findOne({ where: { id } });
    if (!partiya) {
      throw new NotFoundException('Partiya not found!');
    }
    const expensePerKv = value / partiya.volume;
    const response = await this.partiyaRepository.update({ id }, { expense: value, expensePerKv });
    await this.actionService.create(partiya, user.id, null, 'update_partiya', `Партия изминил. $${value}`);
    return response;
  }

  async create(value: CreatePartiyaDto, user) {
    await this.actionService.create(value, user.id, null, 'partiya_create');
    const filial = await this.filialRepository.findOne({ where: { id: value.warehouse } });

    if (!filial) {
      throw new NotFoundException('Filial not found!');
    }

    if (filial.type !== FilialTypeEnum.WAREHOUSE) {
      throw new BadRequestException("Partiya can only be associated with a filial of type 'warehouse'");
    }

    const data = this.partiyaRepository.create({
      ...value,
      expensePerKv: value.expense / value.volume,
      partiya_status: PartiyaStatusEnum.NEW,
    } as unknown as Partiya);
    return await this.partiyaRepository.save(data);
  }

  async changeStatus(id: string, status: PartiyaStatusEnum, user: User) {
    const partiya = await this.partiyaRepository.findOne({ where: { id } });

    if (!partiya) {
      throw new BadRequestException('Партия не найдена!');
    } else if (status === PartiyaStatusEnum.PENDING && user.position.role === UserRoleEnum.M_MANAGER) {
      //
      const report = await this.excelProductService.getReport(partiya.id);

      if (Number(report.volume).toFixed(2) !== Number(partiya.volume).toFixed(2))
        throw new BadRequestException('Партия не может быть закрыта до тех пор, пока объем продукции не сравняется с объемом партии.');

      return await this.partiyaRepository.update({ id }, { partiya_status: status });
      //
    } else if (status === PartiyaStatusEnum.CLOSED && (user.position.role === UserRoleEnum.W_MANAGER || user.position.role === UserRoleEnum.M_MANAGER)) {
      //
      const report = await this.excelProductService.getReport(partiya.id, ProductReportEnum.INVENTORY);
      if (Number(report.volume).toFixed(2) !== Number(partiya.volume).toFixed(2))
        throw new BadRequestException('Партия не может быть закрыта до тех пор, пока объем продукции не сравняется с объемом партии.');

      return await this.partiyaRepository.update({ id }, { partiya_status: status });
      //
    } else if (status === PartiyaStatusEnum.FINISHED && user.position.role === UserRoleEnum.M_MANAGER) {
      //
      const report = await this.excelProductService.getReport(partiya.id, ProductReportEnum.INVENTORY);

      if (Number(report.volume).toFixed(2) !== Number(partiya.volume).toFixed(2))
        throw new BadRequestException('Партия не может быть закрыта до тех пор, пока объем продукции не сравняется с объемом партии.');

      await this.excelProductService.createProducts(partiya.id);
      return await this.partiyaRepository.update({ id }, { partiya_status: status });
      //
    } else {
      throw new BadRequestException(`вы не можете закрыть партию как ${user.position.title}`);
    }
  }

  async correctAll(id) {
    await this.partiyaRepository.query(`
      update productexcel as pe
      set check_count = pe.count
      where id in (select pe2.id
                   from productexcel pe2
                   left join qrbase qb on pe2."barCodeId" = qb.id
                   where pe2."partiyaId" = $1
                     and "isMetric" = false)
    `, [id]);

    await this.partiyaRepository.query(`
      update productexcel as pe
      set check_count = pe.y * 100
      where id in (select pe2.id
                   from productexcel pe2
                   left join qrbase qb on pe2."barCodeId" = qb.id
                   where pe2."partiyaId" = $1
                     and "isMetric" = true)
    `, [id]);

    return 'ok';
  }
}

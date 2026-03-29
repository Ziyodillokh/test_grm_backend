import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { EntityManager, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { Filial } from './filial.entity';
import { CreateDealerDto, CreateFilialDto, UpdateFilialDto } from './dto';
import FilialType from '../../infra/shared/enum/filial-type.enum';
import { FilialReportService } from '../filial-report/filial-report.service';
import { FilialReportStatusEnum, FilialTypeEnum, UserRoleEnum } from '../../infra/shared/enum';
import { User } from '../user/user.entity';
import { PositionService } from '../position/position.service';
import { hashPassword } from '../../infra/helpers';
import { Kassa } from '../kassa/kassa.entity';
import { ReportService } from '../report/report.service';
import { KassaService } from '../kassa/kassa.service';

import { PlanYearService } from '../plan-year/plan-year.service';

@Injectable()

export class FilialService {
  constructor(
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @Inject(forwardRef(() => FilialReportService))
    private readonly filialReportService: FilialReportService,
    private readonly entityManager: EntityManager,
    private readonly positionService: PositionService,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => KassaService))
    private readonly kassaService: KassaService,
    private readonly planYearService: PlanYearService,
  ) {}

  async getAll(options: IPaginationOptions, where?: FindOptionsWhere<Filial>): Promise<Pagination<Filial>> {
    return paginate<Filial>(this.filialRepository, options, {
      order: {
        title: 'ASC',
      },
      relations: {
        manager: true,
      },
      where,
    });
  }

  async getAllFilial() {
    return await this.filialRepository.find({
      where: {
        isActive: true,
        type: Not(FilialType.DEALER),
      },
    });
  }

  async getOne(id: string) {
    return await this.filialRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('data not found');
      });
  }

  async getTwoFilial(from: string, to) {
    return await this.filialRepository.find({
      where: { id: In([from, to]) },
      relations: { manager: true },
    });
  }

  async getOneForUserAndKassa(id: string) {
    return await this.filialRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('data not found');
      });
  }

  async getBaza() {
    return await this.filialRepository
      .findOne({
        where: { title: 'baza' },
        relations: {
          products: {
            bar_code: { model: true, color: true },
          },
        },
      })
      .catch(() => {
        throw new NotFoundException('Baza not found');
      });
  }

  async deleteOne(id: string) {
    // Use TypeORM soft-delete (sets deletedDate) + set isDeleted flag for backward compatibility
    const filial = await this.filialRepository.findOne({ where: { id } });
    if (!filial) throw new NotFoundException('data not found');
    filial.isDeleted = true;
    await this.filialRepository.save(filial);
    return await this.filialRepository.softDelete(id);
  }

  async change(value: UpdateFilialDto, id: string) {
    return await this.filialRepository.update({ id }, value);
  }
  async create(value: CreateFilialDto) {
    const newFilial = this.filialRepository.create(value as unknown as Filial);
    const savedFilial = await this.filialRepository.save(newFilial);

    if (savedFilial.type !== FilialTypeEnum.WAREHOUSE) {
      const newKassa = this.kassaRepository.create({
        filial: savedFilial,
        startDate: new Date(),
        isActive: true,
      });

      await this.kassaRepository.save(newKassa);

      await this.reportService.generateReportsByYear();
      await this.reportService.generateAndLinkReportsByYear();

      if (savedFilial.type === FilialTypeEnum.FILIAL) {
        try {
          const result = await this.planYearService.createPlanForNewFilial(savedFilial.id);
          if (!result.created) {
            console.warn(`Filial uchun plan yaratishda xatolik: ${result.message}`);
          } else {
            console.log(`Filial "${savedFilial.name}" uchun plan muvaffaqiyatli yaratildi`);
          }
        } catch (error) {
          console.error('Filial uchun plan yaratishda xatolik:', error);
        }
      }
    }

    return savedFilial;
  }

  async createDealerWithManager(
    value: CreateDealerDto,
  ): Promise<{ success: boolean; filialId: number }> {
    return this.entityManager.transaction(async (manager) => {
      const position = await this.positionService.getOneByRole(UserRoleEnum.DEALER);

      const hashedPassword = await hashPassword(value.login); // ✅ fixed

      // Create filial
      const filialInsert = await manager
        .createQueryBuilder()
        .insert()
        .into(this.filialRepository.target)
        .values({
          title: value.title,
          type: FilialType.DEALER,
          phone1: value.phone1,
          address: value.address,
        })
        .returning('id') // ✅ ensures we get the id
        .execute();

      const filialId = filialInsert.identifiers[0]?.id;
      if (!filialId) {
        throw new Error('Failed to create filial. No ID returned.');
      }

      // Create manager user
      const managerInsert = await manager
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          position,
          login: value.login,
          password: hashedPassword,
          firstName: value.firstName,
          lastName: value.lastName,
          fatherName: value.fatherName,
          filial: { id: filialId }, // ✅ relation fix
        })
        .returning('id')
        .execute();

      const managerId = managerInsert.identifiers[0]?.id;
      if (!managerId) {
        throw new Error('Failed to create manager. No ID returned.');
      }

      // Update filial with manager reference
      await manager
        .createQueryBuilder()
        .update(this.filialRepository.target)
        .set({ manager: { id: managerId } }) // ✅ relation fix
        .where('id = :id', { id: filialId }) // ✅ prevent full-table update
        .execute();

      return { success: true, filialId };
    });
  }

  async findOrCreateFilialByTitle(title: string): Promise<Filial> {
    let response = await this.filialRepository.findOne({ where: { title } });

    if (!response) {
      const data = {
        title,
        address: 'Baza',
        startWorkTime: '00:00',
        endWorkTime: '23:59',
        addressLink: 'https://maps.app.goo.gl/fdoNS4WeGJR7pgJm6',
        landmark: 'Evos',
        phone1: '+99897-777-77-77',
        phone2: '+99898-888-88-88',
        type: FilialType.WAREHOUSE,
      };
      response = this.filialRepository.create(data);
      await this.filialRepository.save(response);
    }

    return response;
  }

  async name() {
    const data = await this.filialRepository.find({
      where: {
        type: FilialType.FILIAL,
      },
    });

    (data as any[]).unshift({ id: 'boss', name: 'Boss' }, { id: 'manager', name: 'Manager' });

    return data;
  }

  async getBazaFor() {
    return await this.filialRepository.findOne({
      where: { title: 'baza' },
    });
  }

  async getFilialWithKassa() {
    return this.filialRepository.find({
      relations: { kassa: { orders: true } },
      where: { isActive: true, type: FilialType.FILIAL },
    });
  }

  async getIDokon() {
    const [data] = await this.filialRepository.find({ where: { title: 'I-Dokon' } });
    if (!data) {
      const req = this.filialRepository.create({
        title: 'I-Dokon',
        name: 'I-Dokon',
        telegram: 't.me/sanat-hali',
        address: 'Internet magazin',
        startWorkTime: '09:00',
        endWorkTime: '21:00',
        addressLink: 'https://maps.app.goo.gl/PTP4RyzLSnHbNKSNA',
        landmark: 'Sanat Hali',
        phone1: '+998 99 761-11-11',
        phone2: '+998 99 761-11-11',
      });
      return await this.filialRepository.save(req);
    }
    return data;
  }

  async getFilials4hick() {
    return await this.filialRepository.find({
      where: {
        type: FilialType.FILIAL,
      },
    });
  }

  async getWarehouses(options: IPaginationOptions, where?: FindOptionsWhere<Filial>): Promise<Pagination<Filial>> {
    return paginate<Filial>(this.filialRepository, options, {
      order: {
        title: 'ASC',
      },
      where: {
        isActive: true,
        type: FilialType.WAREHOUSE,
      },
    });
  }

  async makeReport(id: string) {
    await this.filialReportService.create({
      filial: id,
      cost: 0,
      volume: 0,
      status: FilialReportStatusEnum.OPEN,
    });
    return await this.filialRepository.update({ id }, { need_get_report: true });
  }

  async changeReport(id: string, bool: boolean) {
    await this.filialRepository.update(id, { need_get_report: bool });
  }

  async endReport(id: string) {
    const report = await this.filialReportService.getOne(id);

    await this.filialReportService.update(id, {
      status: FilialReportStatusEnum.ACCEPTED,
    });

    await this.filialRepository
      .createQueryBuilder()
      .update()
      .set({ need_get_report: false })
      .where('id = :id', { id: report.filial.id })
      .execute();

    return await this.filialRepository.update(report?.filial?.id, { need_get_report: false });
  }

  async rejectReport(id: string) {
    return await this.filialReportService.update(id, {
      status: FilialReportStatusEnum.REJECTED,
    });
  }

  async abortReport(id: string) {
    await this.filialReportService.delete(id);
    return await this.filialRepository.update({ filial_reports: { id: In([id]) } }, { need_get_report: false });
  }

  async getFilialTypeWarehousesAndFIlials(
    options: IPaginationOptions,
    where?: FindOptionsWhere<Filial>,
  ): Promise<Pagination<Filial>> {
    const baseWhere: FindOptionsWhere<Filial> = {
      isActive: true,
      type: In([FilialType.FILIAL, FilialType.WAREHOUSE]),
      ...(where || {}),
    };

    return paginate<Filial>(this.filialRepository, options, {
      where: baseWhere,
    });
  }
}

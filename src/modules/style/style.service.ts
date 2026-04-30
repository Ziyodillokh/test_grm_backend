import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, ILike, Repository } from 'typeorm';

import { CreateStyleDto, UpdateStyleDto } from './dto';
import { Style } from './style.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class StyleService {
  constructor(
    @InjectRepository(Style)
    private readonly styleRepository: Repository<Style>,
    private readonly entityManager: EntityManager,
    private readonly dataSource: DataSource,

  ) {}

  async getAll(options: IPaginationOptions, where: { title: string }) {
    return paginate<Style>(this.styleRepository, options, {
      order: {
        title: 'ASC',
      },
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      }
    })
  }

  async getAllWithCounts(options: IPaginationOptions, where: { title?: string }) {
    const qb = this.styleRepository
      .createQueryBuilder('e')
      .leftJoin('qrbase', 'qb', 'qb."styleId" = e.id AND qb."deletedDate" IS NULL')
      .select('e.id', 'id')
      .addSelect('e.title', 'title')
      .addSelect('COUNT(qb.id)', 'qrBaseCount')
      .groupBy('e.id')
      .orderBy('e.title', 'ASC');
    if (where.title) qb.andWhere('e.title ILIKE :title', { title: `%${where.title}%` });
    const limit = Number(options.limit) || 50;
    const page = Number(options.page) || 1;
    const [items, totalCount] = await Promise.all([
      qb.clone().offset((page - 1) * limit).limit(limit).getRawMany(),
      this.styleRepository.count({ where: where.title ? { title: ILike(`%${where.title}%`) } : {} }),
    ]);
    return {
      items: items.map((it) => ({ id: it.id, title: it.title, qrBaseCount: Number(it.qrBaseCount) || 0 })),
      meta: { totalItems: totalCount, itemCount: items.length, itemsPerPage: limit, totalPages: Math.ceil(totalCount / limit), currentPage: page },
    };
  }

  async getOne(id: string) {
    const data = await this.styleRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Style not found');
      });

    return data;
  }

  async getOneByName(title: string) {
    const data = await this.styleRepository
      .findOne({
        where: { title: ILike(title) },
      })
      .catch(() => {
        throw new NotFoundException('Style not found');
      });

    return data;
  }

  async deleteOne(id: string) {
    // Style o'chirilganda, bog'liq qrbase'lar styleId NULL ga o'tadi (onDelete: 'SET NULL')
    return await this.styleRepository.delete(id).catch(() => {
      throw new NotFoundException('Style not found');
    });
  }

  async change(value: UpdateStyleDto, id: string) {
    const response = await this.styleRepository.update({ id }, value);
    return response;
  }

  async create(value: CreateStyleDto) {
    const data = this.styleRepository.create(value);
    return await this.styleRepository.save(data);
  }

  async findOrCreate(title) {
    title = title.toLowerCase().trim().split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const response = await this.styleRepository.findOne({
      where: { title: ILike(`%${title}%`) },
    });

    if (!response) {
      return (await this.create({ title })).id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.styleRepository.findOne({
      where: { title },
    });

    return response?.id || null;
  }

  async mergeColorReferences(
    oldStyleId: string,
    newStyleTitle: string,
  ) {
    const styleRepo = this.dataSource.getRepository('style');
    const oldStyle = await styleRepo.findOneBy({ id: oldStyleId });
    if (!oldStyle) throw new Error('Old style not found');

    const existingStyle = await styleRepo.findOne({ where: { title: newStyleTitle } });

    if (!existingStyle) {
      // Just update the title
      await styleRepo.update(oldStyleId, { title: newStyleTitle });
      return { message: 'style title updated.' };
    }

    const client = this.dataSource.createQueryRunner();
    await client.connect();
    await client.startTransaction();

    try {
      // Step 1: Find all foreign key references to style
      const refs = await client.query(`
  SELECT
    kcu.table_name,
    kcu.column_name
  FROM
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.constraint_schema = ccu.constraint_schema
  WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'style'
`);

      for (const ref of refs) {
        const table = ref.table_name;
        const column = ref.column_name;

        // Step 2: Update all rows in this table from oldStyleId to existingStyle.id
        await client.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
          [existingStyle.id, oldStyleId],
        );
      }

      // Step 3: Delete the old color
      await client.manager.delete('style', oldStyleId);

      await client.commitTransaction();
      return { message: 'Merged references and deleted old style.' };
    } catch (err) {
      await client.rollbackTransaction();
      throw err;
    } finally {
      await client.release();
    }
  }
}

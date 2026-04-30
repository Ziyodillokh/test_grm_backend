import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, ILike, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { CreateCountryDto, UpdateCountryDto } from './dto';
import { Country } from './country.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CountryService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    private readonly entityManager: EntityManager,
    private readonly dataSource: DataSource,
  ) {}

  async getAll(options: IPaginationOptions, where: {title: string}): Promise<Pagination<Country>> {
    return paginate<Country>(this.countryRepository, options, {
      order: {
        title: 'ASC',
      },
      where: {
        ...(where.title && {title: ILike(`%${where.title}%`)})
      }
    });
  }

  /**
   * Country list + her birida nechta QrBase ishlatilganini qaytaradi.
   * Frontend data-library/countries sahifasi uchun.
   */
  async getAllWithCounts(options: IPaginationOptions, where: { title?: string }) {
    const qb = this.countryRepository
      .createQueryBuilder('country')
      .leftJoin('qrbase', 'qb', 'qb."countryId" = country.id AND qb."deletedDate" IS NULL')
      .select('country.id', 'id')
      .addSelect('country.title', 'title')
      .addSelect('COUNT(qb.id)', 'qrBaseCount')
      .groupBy('country.id')
      .orderBy('country.title', 'ASC');

    if (where.title) {
      qb.andWhere('country.title ILIKE :title', { title: `%${where.title}%` });
    }

    const limit = Number(options.limit) || 50;
    const page = Number(options.page) || 1;
    const offset = (page - 1) * limit;

    const [items, totalCount] = await Promise.all([
      qb.clone().offset(offset).limit(limit).getRawMany(),
      this.countryRepository.count({
        where: where.title ? { title: ILike(`%${where.title}%`) } : {},
      }),
    ]);

    return {
      items: items.map((it) => ({
        id: it.id,
        title: it.title,
        qrBaseCount: Number(it.qrBaseCount) || 0,
      })),
      meta: {
        totalItems: totalCount,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      },
    };
  }

  async find() {
    return await this.countryRepository.find();
  }

  async getOne(id: string) {
    const data = await this.countryRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Country not found');
      });

    return data;
  }

  async deleteOne(id: string) {
    // Country o'chirilganda, bog'liq qrbase'lar countryId NULL ga o'tadi (FK cascade)
    return await this.countryRepository.delete(id).catch(() => {
      throw new NotFoundException('Country not found');
    });
  }

  async change(value: UpdateCountryDto, id: string) {
    return await this.countryRepository.update({ id }, value);
  }

  async create(value: CreateCountryDto) {
    const data = this.countryRepository.create(value);
    return await this.countryRepository.save(data);
  }

  async findOrCreate(title) {
    title = title.toLowerCase().trim().split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const response = await this.countryRepository.findOne({
      where: { title: ILike(`%${title}%`) },
    });

    if (!response) {
      return (await this.create({ title })).id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.countryRepository.findOne({
      where: { title },
    });

    return response.id || null;
  }

  async mergeColorReferences(
    oldCountryId: string,
    newCountryTitle: string,
  ) {
    const countryRepo = this.dataSource.getRepository('country');
    const oldCountry = await countryRepo.findOneBy({ id: oldCountryId });
    if (!oldCountry) throw new Error('Old country not found');

    const existingCountry = await countryRepo.findOne({ where: { title: newCountryTitle } });

    if (!existingCountry) {
      // Just update the title
      await countryRepo.update(oldCountryId, { title: newCountryTitle });
      return { message: 'Country title updated.' };
    }

    const client = this.dataSource.createQueryRunner();
    await client.connect();
    await client.startTransaction();

    try {
      // Step 1: Find all foreign key references to color
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
    AND ccu.table_name = 'country'
`);

      for (const ref of refs) {
        const table = ref.table_name;
        const column = ref.column_name;

        // Step 2: Update all rows in this table from oldCountryId to existingCountry.id
        await client.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
          [existingCountry.id, oldCountryId],
        );
      }

      // Step 3: Delete the old country
      await client.manager.delete('country', oldCountryId);

      await client.commitTransaction();
      return { message: 'Merged references and deleted old country.' };
    } catch (err) {
      await client.rollbackTransaction();
      throw err;
    } finally {
      await client.release();
    }
  }
}

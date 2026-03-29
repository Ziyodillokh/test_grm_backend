import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';

import { Color } from './color.entity';
import { CreateColorDto, UpdateColorDto } from './dto';
import { QrBaseService } from '../qr-base/qr-base.service';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class ColorService {
  constructor(
    @InjectRepository(Color)
    private readonly colorRepository: Repository<Color>,
    @Inject(forwardRef(() => QrBaseService))
    private readonly qrBaseService: QrBaseService,
    private readonly dataSource: DataSource,
  ) {}

  async getAll(options: IPaginationOptions, where: {title: string}) {
    return paginate<Color>(this.colorRepository, options, {
      order: {
        title: 'ASC',
      },
      where: {
        ...(where.title && {title: ILike(`%${where.title}%`)})
      }
    })
  }

  async getOne(id: string) {
    return await this.colorRepository.findOne({
      where: { id },
    });
  }

  async getOneByName(title: string) {
    return await this.colorRepository
      .findOne({
        where: { title: ILike(title) },
      })
      .catch(() => {
        throw new NotFoundException('Color not found');
      });
  }

  async deleteOne(id: string) {
    await this.qrBaseService.changeInActive(id);
    return await this.colorRepository.delete(id).catch(() => {
      throw new NotFoundException('Color not found');
    });
  }

  async change(value: UpdateColorDto, id: string) {
    return await this.colorRepository.update({ id }, value);
  }

  async create(value: CreateColorDto) {
    const data = this.colorRepository.create(value);
    return await this.colorRepository.save(data);
  }

  async findOrCreate(title) {
    title = title.toLowerCase().trim().split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const response = await this.colorRepository.findOne({
      where: { title },
    });

    if (!response) {
      return (await this.create({ title })).id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.colorRepository.findOne({
      where: { title },
    });

    return response?.id || null;
  }

  async mergeColors() {
    const colors: Color[] = await this.colorRepository.find();
    return this.groupSimilarColors(colors);
  }

  async mergeColorReferences(
    oldColorId: string,
    newColorTitle: string,
  ) {
    const colorRepo = this.dataSource.getRepository('color');
    const oldColor = await colorRepo.findOneBy({ id: oldColorId });
    if (!oldColor) throw new Error('Old color not found');

    const existingColor = await colorRepo.findOne({ where: { title: newColorTitle } });

    if (!existingColor) {
      // Just update the title
      await colorRepo.update(oldColorId, { title: newColorTitle });
      return { message: 'Color title updated.' };
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
    AND ccu.table_name = 'color'
`);

      for (const ref of refs) {
        const table = ref.table_name;
        const column = ref.column_name;

        // Step 2: Update all rows in this table from oldColorId to existingColor.id
        await client.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
          [existingColor.id, oldColorId],
        );
      }

      // Step 3: Delete the old color
      await client.manager.delete('color', oldColorId);

      await client.commitTransaction();
      return { message: 'Merged references and deleted old color.' };
    } catch (err) {
      await client.rollbackTransaction();
      throw err;
    } finally {
      await client.release();
    }
  }

  private groupSimilarColors(colors: Color[]): any[] {
    const groupedColorsMap = new Map<string, Color[]>();

    colors.forEach((color) => {
      const key = color.title.toLowerCase();

      if (groupedColorsMap.has(key)) {
        groupedColorsMap.get(key).push(color);
      } else {
        groupedColorsMap.set(key, [color]);
      }
    });

    return Array.from(groupedColorsMap.values());
  }
}

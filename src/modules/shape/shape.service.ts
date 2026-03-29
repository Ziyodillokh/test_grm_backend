import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, ILike, Repository } from 'typeorm';

import { CreateShapeDto, UpdateShapeDto } from './dto';
import { Shape } from './shape.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class ShapeService {
  constructor(
    @InjectRepository(Shape)
    private readonly shapeRepository: Repository<Shape>,
    private readonly entityManager: EntityManager,
    private readonly dataSource: DataSource,
  ) {}

  async getAll(options: IPaginationOptions, where) {
    return paginate<Shape>(this.shapeRepository, options, {
      order: {
        title: 'ASC',
      },
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      }
    })
  }

  async getOne(id: string) {
    const data = await this.shapeRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Shape not found');
      });

    return data;
  }

  async getOneByName(title: string) {
    const data = await this.shapeRepository
      .findOne({
        where: { title: ILike(`%${title}%`) },
      })
      .catch(() => {
        throw new NotFoundException('Shape not found');
      });

    return data;
  }

  async deleteOne(id: string) {
    await this.entityManager
      .getRepository('qrbase')
      .createQueryBuilder('qrbase').update().set({ is_active: false })
      .where('shapeId = :id', { id }).execute();

    return await this.shapeRepository.delete(id).catch(() => {
      throw new NotFoundException('Shape not found');
    });
  }

  async change(value: UpdateShapeDto, id: string) {
    const response = await this.shapeRepository.update({ id }, value);
    return response;
  }

  async create(value: CreateShapeDto) {
    const data = this.shapeRepository.create(value);
    return await this.shapeRepository.save(data);
  }

  async mergeShapeReferences(
    oldShapeId: string,
    newShapeTitle: string,
  ) {
    const shapeRepo = this.dataSource.getRepository('shape');
    const oldShape = await shapeRepo.findOneBy({ id: oldShapeId });
    if (!oldShape) throw new Error('Old shape not found');

    const existingShape = await shapeRepo.findOne({ where: { title: newShapeTitle } });

    if (!existingShape) {
      // Just update the title
      await shapeRepo.update(oldShapeId, { title: newShapeTitle });
      return { message: 'Shape title updated.' };
    }

    const client = this.dataSource.createQueryRunner();
    await client.connect();
    await client.startTransaction();

    try {
      // Step 1: Find all foreign key references to shape
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
    AND ccu.table_name = 'shape'
`);

      for (const ref of refs) {
        const table = ref.table_name;
        const column = ref.column_name;

        // Step 2: Update all rows in this table from oldShapeId to existingShape.id
        await client.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
          [existingShape.id, oldShapeId],
        );
      }

      // Step 3: Delete the old shape
      await client.manager.delete('shape', oldShapeId);

      await client.commitTransaction();
      return { message: 'Merged references and deleted old shape.' };
    } catch (err) {
      await client.rollbackTransaction();
      throw err;
    } finally {
      await client.release();
    }
  }

  async findOrCreate(title) {
    title = title.toLowerCase().trim().split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const response = await this.shapeRepository.findOne({
      where: { title: ILike(`%${title}%`) },
    });

    if (!response) {
      const shape = await this.create({ title });

      return shape.id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.shapeRepository.findOne({
      where: { title },
    });

    return response.id;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Repository } from 'typeorm';
import { Factory } from './factory.entity';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import { CreateFactoryDto, UpdateFactoryDto } from './dto';
import { Country } from '@modules/country/country.entity';

@Injectable()
export class FactoryService {
  constructor(
    @InjectRepository(Factory)
    private readonly repository: Repository<Factory>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    private readonly entityManager: EntityManager,
  ) {
  }

  async create(data: CreateFactoryDto) {
    const res = this.repository.create(data as unknown as Factory);
    return await this.repository.save(res);
  }

  async getAll(options: IPaginationOptions, where: { title: string }) {
    return paginate<Factory>(this.repository, options, {
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      },
      relations: {
        country: true,
      },
    });
  }

  async getOne(id: string) {
    return await this.repository.findOne({ where: { id } });
  }

  async deleteOne(id: string) {
    await this.entityManager
      .getRepository('qrbase')
      .createQueryBuilder('qrbase').update().set({ is_active: false })
      .where('factoryId = :id', { id }).execute();

    return await this.repository.delete(id).catch(() => {
      throw new NotFoundException('factory not found');
    });
  }

  async change(value: UpdateFactoryDto, id: string) {
    return await this.repository
      .createQueryBuilder()
      .update()
      .set(value as unknown as Factory)
      .where('id = :id', { id })
      .execute();
  }

  async findOrCreate(title, country) {
    title = title.toLowerCase().trim().split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const response = await this.repository.findOne({
      where: { title: ILike(`%${title}%`) },
    });

    if (!response) {
      return (await this.create({ title, country })).id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.repository.findOne({
      where: { title },
    });

    return response?.id || null;
  }

  async connectFactoriesToCountry(data: { countryId: string; factories: string[] }) {
    const exists = await this.countryRepository.existsBy({ id: data.countryId });
    if (!exists) throw new Error(`Country ${data.countryId} does not exist`);

    await this.repository
      .createQueryBuilder()
      .update()
      .set({ country: () => `:countryId` })
      .whereInIds(data.factories)
      .setParameters({ countryId: data.countryId })
      .execute();
  }
}

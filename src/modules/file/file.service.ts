import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CreateFileDto, UpdateFileDto } from './dto';

import { File } from './file.entity';
import { EntityManager, Repository } from 'typeorm';
import { QrBase } from '../qr-base/qr-base.entity';

@Injectable()

export class FileService {
  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly entityManager: EntityManager,
  ) {
  }

  async create(data: CreateFileDto) {
    // const response = this.fileRepository.create(data);
    //
    // return await this.fileRepository.save(response);
  }

  async update(data: UpdateFileDto, id: string) {
    // return await this.fileRepository.update({ id }, data);
  }

  async delete(id: string) {
    return await this.fileRepository.delete(id).catch(() => {
      throw new NotFoundException('data not found');
    });
  }

  async deleteByUrl(url: string) {
    // const file = await this.getByUrl(url);
    // return await this.fileRepository.delete(file.id).catch(() => {
    //   throw new NotFoundException('data not found');
    // });
  }

  async getAll(options: IPaginationOptions): Promise<Pagination<File>> {
    return paginate<File>(this.fileRepository, options);
  }

  async getByModel(model: string) {
    // return await this.fileRepository.find({ where: { model } });
  }

  // async getByUrl(url: string) {
  //   return await this.fileRepository.findOne({ where: { url } });
  // }

  async getWith(where) {
    return await this.fileRepository.findOne({
      where,
    });
  }

  async createOrUpdate(data: CreateFileDto) {
    const { img, shape, color, collection, model, is_video = false } = data;

    const fileMatch = {
      model: { id: model },
      color: { id: color },
      shape: { id: shape },
      collection: { id: collection },
    };

    const [oldFile] = await this.fileRepository.find({ where: { ...fileMatch, is_video } });

    if (oldFile) {
      await Promise.allSettled([
        this.fileRepository.update({ id: oldFile.id }, { media: img, is_video }),
        this.entityManager.update(QrBase, fileMatch, { imgUrl: img }),
      ]);
      return;
    }

    const createdFile = this.fileRepository.create({ media: img, ...fileMatch, is_video });
    await Promise.allSettled([
      this.fileRepository.save(createdFile),
      this.entityManager.update(QrBase, fileMatch, { imgUrl: img }),
    ]);
  }
}

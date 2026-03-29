import { Injectable } from '@nestjs/common';
import { Media } from './media.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMediaDto } from './dto';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly repository: Repository<Media>,
  ) {
  }
  async create(data: CreateMediaDto) {
    const res = this.repository.create(data as unknown as Media)
    return this.repository.save([res])
  }

  async getOne(id) {
    return await this.repository.findOne({ where: { id } });
  }
}
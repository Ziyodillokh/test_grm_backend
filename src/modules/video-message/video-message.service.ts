import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VideoMessage } from './video-message.entity';
import { CreateVideoMessageDto } from './dto/create-video-message.dto';
import { User } from '../user/user.entity';

@Injectable()
export class VideoMessageService {
  constructor(
    @InjectRepository(VideoMessage)
    private readonly videoMessageRepository: Repository<VideoMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateVideoMessageDto, senderId: string): Promise<VideoMessage> {
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
      relations: ['position'],
    });

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    if (sender.position?.role === 2) {
      throw new ForbiddenException('Sellers cannot create video messages');
    }

    const videoMessage = this.videoMessageRepository.create({
      videoPath: dto.videoPath,
      title: dto.title,
      description: dto.description,
      targetRole: dto.targetRole,
      sender,
    });

    if (dto.targetUserId) {
      const targetUser = await this.userRepository.findOne({ where: { id: dto.targetUserId } });
      if (!targetUser) {
        throw new NotFoundException('Target user not found');
      }
      videoMessage.targetUser = targetUser;
    }

    return await this.videoMessageRepository.save(videoMessage);
  }

  async findAll(userId: string, userRole: number): Promise<VideoMessage[]> {
    if (userRole === 2) {
      throw new ForbiddenException('Sellers cannot access video messages');
    }

    const query = this.videoMessageRepository
      .createQueryBuilder('vm')
      .leftJoinAndSelect('vm.sender', 'sender')
      .leftJoinAndSelect('vm.targetUser', 'targetUser')
      .where('vm.isActive = :isActive', { isActive: true })
      .andWhere(
        '(vm.targetRole IS NULL OR vm.targetRole = :userRole OR targetUser.id = :userId OR sender.id = :userId)',
        { userRole, userId },
      )
      .orderBy('vm.dateOne', 'DESC');

    return await query.getMany();
  }

  async findOne(id: string): Promise<VideoMessage> {
    const videoMessage = await this.videoMessageRepository.findOne({
      where: { id },
      relations: ['sender', 'targetUser'],
    });

    if (!videoMessage) {
      throw new NotFoundException('Video message not found');
    }

    return videoMessage;
  }

  async delete(id: string): Promise<void> {
    const videoMessage = await this.findOne(id);
    await this.videoMessageRepository.softDelete(videoMessage.id);
  }
}

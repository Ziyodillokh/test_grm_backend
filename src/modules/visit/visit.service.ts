import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../client/client.entity';
import { User } from '../user/user.entity';
import { Visit, VisitOutcomeEnum } from './visit.entity';

@Injectable()
export class VisitService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepo: Repository<Visit>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async createNoPurchase(clientId: string, seller: User): Promise<Visit> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: { filial: true },
    });
    if (!client) throw new NotFoundException('Mijoz topilmadi');
    if (!seller?.filial?.id && !client.filial?.id) {
      throw new BadRequestException('Filial aniqlanmadi');
    }

    const visit = this.visitRepo.create({
      outcome: VisitOutcomeEnum.NoPurchase,
      client: { id: clientId } as Client,
      seller: { id: seller.id } as User,
      filial: { id: seller?.filial?.id || client.filial.id },
    });
    return this.visitRepo.save(visit);
  }

  async findByClient(clientId: string, limit = 50) {
    return this.visitRepo.find({
      where: { client: { id: clientId } },
      relations: { seller: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGptController } from './chatgpt.controller';
import { ChatGptService } from './chatgpt.service';
import { ChatGptToolsService } from './chatgpt-tools.service';
import { ElevenLabsService } from './elevenlabs.service';
import { ChatInteraction } from './chatgpt.entity';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { Filial } from '../filial/filial.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Kassa } from '../kassa/kassa.entity';
import { Client } from '../client/client.entity';
import { User } from '../user/user.entity';
import { Transfer } from '../transfer/transfer.entity';
import { PlanYear } from '../plan-year/plan-year.entity';
import { Collection } from '../collection/collection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatInteraction,
      Order,
      Product,
      Filial,
      Cashflow,
      Kassa,
      Client,
      User,
      Transfer,
      PlanYear,
      Collection,
    ]),
  ],
  controllers: [ChatGptController],
  providers: [ChatGptService, ChatGptToolsService, ElevenLabsService],
})
export class ChatModule {}

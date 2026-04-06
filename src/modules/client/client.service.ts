import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Order } from '../order/order.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { CashFlowEnum, KassaProgresEnum } from 'src/infra/shared/enum';
import CashflowTipEnum from 'src/infra/shared/enum/cashflow/cashflow-tip.enum';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import { Kassa } from '@modules/kassa/kassa.entity';


@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Filial)
    private readonly filialRepo: Repository<Filial>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,

    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
    private readonly connection: DataSource,
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    const { fullName, phone, comment, filialId, userId } = dto;

    const filial = await this.filialRepo.findOneBy({ id: dto.filialId });
    if (!filial) {
      throw new NotFoundException(`Filial ID ${filialId} not found`);
    }

    const user = await this.userRepo.findOneBy({ id: dto.userId });
    if (!user) {
      throw new NotFoundException(`User ID ${userId} not found`);
    }

    const client = this.clientRepo.create({
      fullName,
      phone,
      comment,
      filial,
      user,
    });

    return this.clientRepo.save(client);
  }

  findAll(options: IPaginationOptions, query: { filial?: string }): Promise<Pagination<Client>> {
    return paginate(this.clientRepo, options, {
      where: {
        ...(query.filial && { filial: { id: query.filial } }),
      },
      relations: {
        filial: true,
      },
    });
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['filial', 'user'],
    });

    if (!client) {
      throw new NotFoundException(`Client ID ${id} not found`);
    }

    return client;
  }

  async findOneByOwed(id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client ID ${id} not found`);
    }

    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    if (dto.fullName !== undefined) client.fullName = dto.fullName;
    if (dto.phone !== undefined) client.phone = dto.phone;
    if (dto.comment !== undefined) client.comment = dto.comment;

    if (dto.filialId) {
      const filial = await this.filialRepo.findOneBy({ id: dto.filialId });
      if (!filial) {
        throw new NotFoundException(`Filial ID ${dto.filialId} not found`);
      }
      client.filial = filial;
    }

    if (dto.userId) {
      const user = await this.userRepo.findOneBy({ id: dto.userId });
      if (!user) {
        throw new NotFoundException(`User ID ${dto.userId} not found`);
      }
      client.user = user;
    }

    return this.clientRepo.save(client);
  }

  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepo.softDelete(client.id);
  }

  async restore(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepo.restore(client.id);
  }

  async payDebt(clientId: string, amount: number, user): Promise<Client> {
    return await this.connection.transaction(async (manager) => {
      const clientRepo = manager.getRepository(Client);
      const orderRepo = manager.getRepository(Order);
      const cashflowRepo = manager.getRepository(Cashflow);
      const kassaRepo = manager.getRepository(Kassa);

      console.log('🔍 payDebt started:', { clientId, amount });

      const client = await clientRepo.findOne({
        where: { id: clientId },
        relations: { filial: true },
      });

      if (!client) {
        console.error('❌ Client not found:', clientId);
        throw new NotFoundException('Client not found');
      }
      console.log('👤 Found client:', { id: client.id, name: client.fullName, owed: client.owed, given: client.given });

      if (!amount || amount <= 0) {
        console.error('⚠️ Invalid payment amount:', amount);
        throw new BadRequestException('Invalid payment amount');
      }

      if (amount > client.owed) {
        throw new BadRequestException(`To'lov miqdori qarz miqdoridan ortiq. Qarz: ${client.owed}, To'lov: ${amount}`);
      }
      client.given = (client.given || 0) + amount;
      client.owed = Math.max((client.owed || 0) - amount, 0);
      console.log('💰 Updated client balances:', { owed: client.owed, given: client.given });

      // qarzga tegishli orderlar (client da bir nechta debt order bo'lishi mumkin)
      const orders = await orderRepo.find({
        where: { client: { id: client.id }, isDebt: true },
        relations: { createdBy: { avatar: true }, kassa: { filial: true } },
        order: { createdAt: 'DESC' },
      });

      if (!orders.length) {
        console.error('⚠️ No debt order found for client:', client.id);
        throw new BadRequestException('Debt order not found for this client');
      }

      const order = orders[0];

      const openKassa = await kassaRepo.findOne({
        where: { filial: { id: client.filial.id }, status: KassaProgresEnum.OPEN, isActive: true },
        relations: {},
      });

      console.log('📦 Found debt order:', { orderId: order.id, kassa: order.kassa?.id, createdBy: order.createdBy?.id });

      // cashflow_type
      const slugDolg = await this.getOneBySlug('qarzdanKelgan');
      console.log('🏷️ Loaded cashflow type (slug qarzdanKelgan):', slugDolg?.id || slugDolg);

      // cashflow yaratish
      const cashflow = cashflowRepo.create({
        price: amount,
        type: CashFlowEnum.InCome,
        tip: CashflowTipEnum.CASHFLOW,
        comment: `${client.fullName} qarzini to‘lab berdi`,
        cashflow_type: slugDolg,
        date: new Date().toISOString(),
        kassa: openKassa,
        filial: order.kassa.filial,
        createdBy: order.createdBy,
        is_online: false,
        is_static: true,
      });
      console.log('📝 Prepared cashflow:', cashflow);

      await cashflowRepo.save(cashflow);
      console.log('✅ Cashflow saved successfully');

      const savedClient = await clientRepo.save(client);
      console.log('💾 Client saved successfully:', {
        clientId: savedClient.id,
        owed: savedClient.owed,
        given: savedClient.given,
      });

      openKassa.totalSum = openKassa.totalSum + amount;
      openKassa.income = openKassa.income + amount;

      await kassaRepo.save(openKassa);

      console.log('🎉 payDebt finished for client:', savedClient.id);
      return savedClient;
    });
  }

  async completeDebt(clientId: string): Promise<Client> {
    return await this.connection.transaction(async (manager) => {
      const clientRepo = manager.getRepository(Client);
      const orderRepo = manager.getRepository(Order);

      const client = await clientRepo.findOne({
        where: { id: clientId },
      });

      if (!client) {
        throw new NotFoundException('Client topilmadi');
      }

      if ((client.owed || 0) > 0) {
        throw new BadRequestException('Qarz hali toliq yopilmagan');
      }

      const debtOrders = await orderRepo.find({
        where: {
          client: { id: clientId },
          isDebt: true,
        },
      });

      for (const order of debtOrders) {
        order.isDebt = false;
        await orderRepo.save(order);
      }

      client.given = 0;
      await clientRepo.save(client);

      return client;
    });
  }

  async addOwed(clientId: string, amount: number, manager?: EntityManager): Promise<Client> {
    const clientRepo = manager ? manager.getRepository(Client) : this.clientRepo;

    const client = await clientRepo.findOne({ where: { id: clientId } });
    if (!client) {
      throw new BadRequestException('Client not found');
    }

    client.owed = Number(client.owed || 0) + Number(amount);

    return await clientRepo.save(client);
  }

  async getTotalDebtByFilial(filialId: string): Promise<number> {
    const result = await this.clientRepo
      .createQueryBuilder('client')
      .select('SUM(client.owed)', 'totalDebt')
      .leftJoin('client.filial', 'filial')
      .where('filial.id = :filialId', { filialId })
      .getRawOne();

    return Number(result?.totalDebt || 0);
  }

  async getTotalDebt(): Promise<number> {
    const result = await this.clientRepo.createQueryBuilder('client').select('SUM(client.owed)', 'totalDebt').getRawOne();

    return Number(result?.totalDebt || 0);
  }

  async getClientsWithDebtOrdersPaginated(
    filialId: string,
    options: IPaginationOptions,
    sellerId?: string,
  ): Promise<Pagination<Order & { client: Client }>> {
    const paginatedClients = await paginate(this.clientRepo, options, {
      where: {
        filial: { id: filialId },
        owed: MoreThan(0),
      },
      order: { fullName: 'ASC' },
    });

    const allOrdersWithClient: (Order & { client: Client })[] = [];

    for (const client of paginatedClients.items) {
      const orders = await this.orderRepo.find({
        where: {
          client: { id: client.id },
          isDebt: true,
          ...(sellerId ? { seller: { id: sellerId } } : {}),
        },
        relations: {
          seller: { avatar: true },
          product: {
            collection_price: true,
            bar_code: {
              model: true,
              collection: true,
              size: true,
            },
          },
        },
      });

      const enrichedOrders = orders.map((order) => ({
        ...order,
        client,
      }));

      allOrdersWithClient.push(...enrichedOrders);
    }
    return {
      items: allOrdersWithClient,
      meta: paginatedClients.meta,
    };
  }

  async getOneBySlug(slug: string) {
    return await this.cashflowTypeRepository
      .findOne({
        where: { slug },
      })
      .catch(() => {
        throw new NotFoundException('Cashflow type not found');
      });
  }
}

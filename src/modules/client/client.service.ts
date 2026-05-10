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
    const { fullName, phone, comment, address, filialId, userId } = dto;

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
      address,
      filial,
      user,
      isDebtor: dto.isDebtor ?? false,
    });

    return this.clientRepo.save(client);
  }

  findAll(options: IPaginationOptions, query: { filial?: string; search?: string }): Promise<Pagination<Client>> {
    const qb = this.clientRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.filial', 'filial')
      .leftJoinAndSelect('c.user', 'seller')
      .where('c."deletedDate" IS NULL');

    if (query.filial) {
      qb.andWhere('c."filialId" = :filialId', { filialId: query.filial });
    }
    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(c."fullName") LIKE :term OR c.phone LIKE :term OR LOWER(c.address) LIKE :term)', { term });
    }
    qb.orderBy('c."dateOne"', 'DESC');

    return paginate(qb, options);
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
    if (dto.address !== undefined) client.address = dto.address;

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

      const currentDebt = Number(client.owed || 0) - Number(client.given || 0);
      if (amount > currentDebt) {
        throw new BadRequestException(`To'lov miqdori qarz qoldig'idan ortiq. Qoldiq: ${currentDebt}, To'lov: ${amount}`);
      }
      // Monotonik: faqat given oshadi, owed o'zgarmaydi
      client.given = Number(client.given || 0) + amount;
      client.totalDebt = Number(client.owed || 0) - Number(client.given);
      console.log('💰 Updated client balances:', { owed: client.owed, given: client.given, totalDebt: client.totalDebt });

      // qarzga tegishli orderlar (client da bir nechta debt order bo'lishi mumkin)
      const orders = await orderRepo.find({
        where: { client: { id: client.id }, isDebt: true },
        relations: { seller: { avatar: true }, kassa: { filial: true } },
        order: { createdAt: 'DESC' },
      });

      const order = orders[0]; // bo'lmasligi mumkin (Qarzdor uchun)

      const openKassa = await kassaRepo.findOne({
        where: { filial: { id: client.filial.id }, status: KassaProgresEnum.OPEN, isActive: true },
        relations: {},
      });

      if (!openKassa) {
        throw new BadRequestException('Bu filialda ochiq kassa topilmadi');
      }

      // cashflow_type
      const slugDolg = await this.getOneBySlug('debt_repayment');

      // cashflow yaratish
      const cashflow = cashflowRepo.create({
        price: amount,
        type: CashFlowEnum.InCome,
        tip: CashflowTipEnum.CASHFLOW,
        comment: `${client.fullName} qarzini to‘lab berdi`,
        cashflow_type: slugDolg,
        date: new Date().toISOString(),
        kassa: openKassa,
        filial: client.filial,
        createdBy: order?.seller,
        client,
        is_online: false,
        is_static: true,
      } as any);
      console.log('📝 Prepared cashflow:', cashflow);

      await cashflowRepo.save(cashflow);
      console.log('✅ Cashflow saved successfully');

      const savedClient = await clientRepo.save(client);
      console.log('💾 Client saved successfully:', {
        clientId: savedClient.id,
        owed: savedClient.owed,
        given: savedClient.given,
      });

      openKassa.inHand += amount;
      openKassa.income += amount;

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

  /**
   * Boss Dashboard "Qarz" cardi uchun: yillik qaytarilgan + qoldiq qarz.
   * - totalDebt: hozirgi yig'ilgan client qarzi (sum of client.owed)
   * - totalReturned: yil davomida qaytarilgan qarz cashflow (slug='debt_repayment' AND type='income')
   */
  async getDebtSummary(year?: number): Promise<{ totalDebt: number; totalReturned: number }> {
    try {
      const debtRow = await this.clientRepo
        .createQueryBuilder('client')
        .select('COALESCE(SUM(client.owed), 0)', 'totalDebt')
        .getRawOne();

      const returnedQb = this.cashflowRepository
        .createQueryBuilder('cashflow')
        .leftJoin('cashflow.cashflow_type', 'cashflow_type')
        .select('COALESCE(SUM(cashflow.price), 0)', 'totalReturned')
        .where('cashflow_type.slug = :slug', { slug: 'debt_repayment' })
        .andWhere('cashflow.type = :type', { type: 'income' });

      if (year) {
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        returnedQb.andWhere('cashflow.date >= :start AND cashflow.date < :end', { start, end });
      }

      const returnedRow = await returnedQb.getRawOne();

      return {
        totalDebt: Number(debtRow?.totalDebt || 0),
        totalReturned: Number(returnedRow?.totalReturned || 0),
      };
    } catch (err) {
      console.error('[client.getDebtSummary] error', err);
      return { totalDebt: 0, totalReturned: 0 };
    }
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

  async getDebtReportByFilials() {
    const rows = await this.connection
      .createQueryBuilder()
      .select('f.id', 'filialId')
      .addSelect('f.title', 'filialTitle')
      .addSelect('COALESCE(SUM(c.owed), 0)', 'totalOwed')
      .addSelect('COALESCE(SUM(c.given), 0)', 'totalGiven')
      .addSelect('COALESCE(SUM(c.owed), 0) - COALESCE(SUM(c.given), 0)', 'balance')
      .addSelect('COUNT(CASE WHEN (c.owed - c.given) > 0 THEN 1 END)', 'clientCount')
      .from('filial', 'f')
      .leftJoin('client', 'c', 'c."filialId" = f.id AND c."deletedDate" IS NULL')
      .where('f.type = :type', { type: 'filial' })
      .andWhere('f."isActive" = true')
      .groupBy('f.id')
      .addGroupBy('f.title')
      .having('(COALESCE(SUM(c.owed), 0) - COALESCE(SUM(c.given), 0)) > 0')
      .orderBy('"balance"', 'DESC')
      .getRawMany();

    const items = rows.map((r) => ({
      filialId: r.filialId,
      filialTitle: r.filialTitle,
      totalOwed: Number(r.totalOwed || 0),
      totalGiven: Number(r.totalGiven || 0),
      balance: Number(r.balance || 0),
      clientCount: Number(r.clientCount || 0),
    }));

    const totals = items.reduce(
      (acc, i) => ({
        totalOwed: acc.totalOwed + i.totalOwed,
        totalGiven: acc.totalGiven + i.totalGiven,
        balance: acc.balance + i.balance,
      }),
      { totalOwed: 0, totalGiven: 0, balance: 0 },
    );

    return { items, totals };
  }

  async getDebtClientsByFilial(
    filialId: string,
    options: IPaginationOptions,
    type?: 'mijoz' | 'qarzdor',
  ) {
    const qb = this.clientRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'seller')
      .where('c."filialId" = :filialId', { filialId })
      .andWhere('c."deletedDate" IS NULL')
      .orderBy('(c.owed - c.given)', 'DESC')
      .addOrderBy('c."createdAt"', 'DESC');

    // Mijoz tab — filial barcha mijozlari. Qarzdor tab — qarzi bor (oddiy qarz yoki sotuvdan qarz)
    if (type === 'qarzdor') {
      qb.andWhere('(c.owed - c.given) > 0');
    }

    const paginatedClients = await paginate(qb, options);

    const items = paginatedClients.items.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      address: c.address,
      isDebtor: c.isDebtor,
      owed: Number(c.owed || 0),
      given: Number(c.given || 0),
      totalDebt: Number(c.owed || 0) - Number(c.given || 0),
      balance: Number(c.owed || 0) - Number(c.given || 0),
      seller: c.user ? {
        id: c.user.id,
        firstName: c.user.firstName,
        lastName: c.user.lastName,
        phone: c.user.phone,
      } : null,
    }));

    const summaryQb = this.clientRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.owed), 0)', 'totalOwed')
      .addSelect('COALESCE(SUM(c.given), 0)', 'totalGiven')
      .addSelect('COALESCE(SUM(c.owed), 0) - COALESCE(SUM(c.given), 0)', 'balance')
      .where('c."filialId" = :filialId', { filialId })
      .andWhere('c."deletedDate" IS NULL');

    if (type === 'qarzdor') {
      summaryQb.andWhere('(c.owed - c.given) > 0');
    }

    const summaryResult = await summaryQb.getRawOne();

    return {
      items,
      meta: paginatedClients.meta,
      summary: {
        totalOwed: Number(summaryResult?.totalOwed || 0),
        totalGiven: Number(summaryResult?.totalGiven || 0),
        balance: Number(summaryResult?.balance || 0),
      },
    };
  }

  async getDebtOrdersByClient(
    clientId: string,
    query: { year?: number; month?: number },
    options: IPaginationOptions,
  ) {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.seller', 'seller')
      .leftJoinAndSelect('seller.avatar', 'avatar')
      .leftJoinAndSelect('o.product', 'product')
      .leftJoinAndSelect('product.collection_price', 'cp')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.size', 'size')
      .where('o."clientId" = :clientId', { clientId })
      .andWhere('o."isDebt" = true');

    if (query.year) {
      qb.andWhere('EXTRACT(YEAR FROM o.date) = :year', { year: query.year });
    }
    if (query.month) {
      qb.andWhere('EXTRACT(MONTH FROM o.date) = :month', { month: query.month });
    }

    qb.orderBy('o.date', 'DESC');

    const paginatedOrders = await paginate(qb, options);

    return {
      items: paginatedOrders.items,
      meta: paginatedOrders.meta,
      client: {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        owed: Number(client.owed || 0),
        given: Number(client.given || 0),
        balance: Number(client.owed || 0) - Number(client.given || 0),
      },
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

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(
    options: IPaginationOptions,
    query: QueryUserDto,
  ): Promise<Pagination<User>> {
    const where: FindOptionsWhere<User> = { isActive: true };

    if (query.search) {
      where.firstName = ILike(`%${query.search}%`);
    }

    if (query.role) {
      where.position = { role: Number(query.role) };
    }

    if (query.filial) {
      where.filial = { id: query.filial };
    }

    return paginate<User>(this.userRepository, options, {
      order: { firstName: 'ASC' },
      where,
      relations: { position: true, filial: true, avatar: true },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.position', 'position')
      .leftJoinAndSelect('user.filial', 'filial')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .where('user.login = :login', { login })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(dto.login || 'default', 10);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
    } as unknown as User);
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.login) {
      dto.password = await bcrypt.hash(dto.login, 10);
    }

    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.userRepository.save(user);
    // Also set deletedDate via TypeORM soft-delete for proper soft-delete semantics
    await this.userRepository.softDelete(id);
  }

  async hardRemove(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
  }

  async validatePassword(login: string, password: string): Promise<User> {
    const user = await this.findByLogin(login);
    if (!user) {
      throw new BadRequestException('Invalid login or password');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new BadRequestException('Invalid login or password');
    }

    return user;
  }

  // -----------------------------------------------------------------------
  // Backward-compatible method aliases (old names used by legacy modules)
  // -----------------------------------------------------------------------

  /** @deprecated use findByLogin */
  async getByLogin(login: string): Promise<User | null> {
    return this.findByLogin(login);
  }

  /** @deprecated use findOne */
  async getOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { position: true, filial: true, avatar: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async findManagersAccountants(): Promise<User[]> {
    return this.userRepository.find({
      where: [
        { position: { role: 9 }, isActive: true },
        { position: { role: 10 }, isActive: true },
      ],
      relations: { position: true, avatar: true, filial: true },
      order: { firstName: 'ASC' },
    });
  }

  /** Find a user by phone where position role is CLIENT (iMarket) */
  async getImarketuserbyPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone },
      relations: { position: true, filial: true },
    });
  }

  /** Create a client user (iMarket registration) */
  async createClient(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data as any);
    const saved = await this.userRepository.save(user);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /** Find user by a specific field (legacy) */
  async getClientBy(field: string, value: any): Promise<User | null> {
    return this.userRepository.findOne({
      where: { [field]: value },
      relations: { position: true, filial: true },
    });
  }

  /** Update user fields (legacy) */
  async change(data: Partial<User>, id: string): Promise<void> {
    await this.userRepository.update(id, data as any);
  }
}

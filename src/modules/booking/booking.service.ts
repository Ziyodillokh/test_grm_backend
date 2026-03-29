import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Booking } from './booking.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import { User } from '../user/user.entity';
import { ProductService } from '../product/product.service';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly repository: Repository<Booking>,
    private readonly productService: ProductService,
  ) {}

  async create(createBooking: CreateBookingDto, user: User) {
    const { product, total } = await this.checkAvailible({
      product_id: createBooking.product,
      count: createBooking.count,
    });
    await this.checkDuplicate({ userId: user.id, productId: createBooking.product });
    const data = this.repository.create({ product: createBooking.product, user: user, count: createBooking.count });
    await this.repository.save(data);
    await this.productService.changeBookCount({ id: product.id, booking_count: total });
    return data;
  }

  findAll(options: IPaginationOptions, where?: FindOptionsWhere<Booking>, user?: User) {
    return paginate<Booking>(this.repository, options, {
      order: {
        createdAt: 'DESC',
      },
      relations: {
        product: {
          bar_code: {
            model: { collection: true },
            color: true,
            collection: true,
            size: true,
            shape: true,
            style: true,
            factory: true,
          },
          filial: true,
        },
        user: true,
      },
      where: {
        ...where,
        ...(user?.id && { user: { id: user.id } }),
      },
    });
  }

  async findOne(id: string) {
    const booking = await this.repository.findOne({
      where: { id },
      relations: {
        product: {
          bar_code: { collection: true, size: true, color: true, model: true },
          filial: true,
        },
        user: true,
      },
    });
    if (!booking) throw new NotFoundException(`Booking #${id} topilmadi`);
    return booking;
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    const booking = await this.repository.findOne({ where: { id }, relations: { product: true } });
    if (!booking) throw new NotFoundException(`Booking #${id} topilmadi`);

    if (updateBookingDto.count !== undefined) {
      const diff = updateBookingDto.count - booking.count;
      const newBookCount = booking.product.booking_count + diff;
      if (newBookCount < 0) throw new BadRequestException('Booking count manfiy bo\'lishi mumkin emas');
      await this.productService.changeBookCount({ id: booking.product.id, booking_count: newBookCount });
    }

    Object.assign(booking, updateBookingDto);
    return await this.repository.save(booking);
  }

  async remove(id: string) {
    const book = await this.repository.findOne({ where: { id }, relations: { product: true } });
    const total: number = book.product.booking_count;
    const count = total - book.count;
    await this.productService.changeBookCount({ id: book.product.id, booking_count: count < 0 ? 0 : count });
    return await this.repository.softDelete(id);
  }

  async restore(id: string): Promise<{ message: string }> {
    const book = await this.repository.findOne({
      where: { id },
      withDeleted: true,
      relations: { product: true },
    });

    if (!book) {
      throw new NotFoundException(`Book with id ${id} not found`);
    }

    const currentCount = book.product.booking_count;
    const restoredCount = currentCount + book.count;

    await this.productService.changeBookCount({
      id: book.product.id,
      booking_count: restoredCount,
    });

    await this.repository.restore(id);

    return { message: 'Book successfully restored and product count updated' };
  }

  async checkDuplicate({ userId, productId }) {
    const data = await this.repository.findOne({
      where: {
        product: {
          id: productId,
        },
        user: {
          id: userId,
        },
      },
    });

    if (data) throw new BadRequestException('You already book this product.');
  }

  async checkAvailible({ product_id, count }) {
    const product = await this.productService.getOne(product_id);
    const total: number = (product.booking_count || 0) + count;
    if (product.bar_code.isMetric && product.y < total) throw new BadRequestException('You can not get this length');
    else if (product.count < total) throw new BadRequestException('You can not book');

    return { product, total };
  }
}

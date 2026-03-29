import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QrCode } from './qr-code.entity';
import { Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { ProductService } from '../product/product.service';

@Injectable()
export class QrCodeService {
  constructor(
    @InjectRepository(QrCode)
    private readonly qrCodeRepo: Repository<QrCode>,
    private readonly productService: ProductService,
  ) {}

  async generateAndSaveQrCode(count: number) {
    const data = [];
    for (let i = 0; i < count; i++) {
      const newQr = this.qrCodeRepo.create();
      data.push(await this.qrCodeRepo.save(newQr));
    }

    return data;
  }

  async findAll(options: IPaginationOptions): Promise<Pagination<QrCode>> {
    const queryBuilder = this.qrCodeRepo.createQueryBuilder('qr');
    queryBuilder.orderBy('qr.sequence', 'ASC');
    queryBuilder.where('qr.is_active = :option', { option: true });
    return paginate<QrCode>(queryBuilder, options);
  }

  async clear() {
    await this.qrCodeRepo.createQueryBuilder().update().set({ is_active: false }).where({ is_active: true }).execute();
  }

  async connectProduct(id: string, qr_codeId: string, product: string) {
    const qrCode = await this.qrCodeRepo.findOneByOrFail({ id });
    qrCode.qr_base = { id: qr_codeId } as any;
    qrCode.product = { id: product } as any;
    await this.qrCodeRepo.save(qrCode);
  }

  async findByQrBase(qrBase: string, filialId: string, id) {
    const product = await this.productService.getByQrBase(filialId, qrBase);
    console.log('product ==============>', product);
    if (!product) throw new BadRequestException('Product not found');
    const qrCode = await this.qrCodeRepo.findOneByOrFail({ sequence: +id });
    qrCode.qr_base = { id: product.bar_code.id } as any;
    qrCode.product = { id: product.id } as any;
    await this.qrCodeRepo.save(qrCode);
  }

  async findOne(id) {
    return await this.qrCodeRepo.findOne({
      where: {
        sequence: id,
      },
      relations: {
        product: {
          filial: true,
        },
      },
    });
  }

  async update(id: string, updateData: Partial<QrCode>) {
    const existingQrCode = await this.qrCodeRepo.findOne({
      where: { id },
    });

    if (!existingQrCode) {
      throw new NotFoundException(`QR Code with ID ${id} not found`);
    }

    await this.qrCodeRepo.update(id, updateData);

    return await this.qrCodeRepo.findOne({
      where: { id },
      relations: {
        product: {
          filial: true,
        },
      },
    });
  }

  // Sequence bo'yicha update qilish uchun qo'shimcha metod
  async updateBySequence(sequence: number, updateData: Partial<QrCode>) {
    const existingQrCode = await this.qrCodeRepo.findOne({
      where: { sequence },
    });

    if (!existingQrCode) {
      throw new NotFoundException(`QR Code with sequence ${sequence} not found`);
    }

    await this.qrCodeRepo.update({ sequence }, updateData);

    return await this.qrCodeRepo.findOne({
      where: { sequence },
      relations: {
        product: {
          filial: true,
        },
      },
    });
  }

  // QR kodning statusini o'zgartirish uchun maxsus metod
  async toggleActiveStatus(id: string) {
    const qrCode = await this.qrCodeRepo.findOne({ where: { id } });

    if (!qrCode) {
      throw new NotFoundException(`QR Code with ID ${id} not found`);
    }

    qrCode.is_active = !qrCode.is_active;
    return await this.qrCodeRepo.save(qrCode);
  }
}

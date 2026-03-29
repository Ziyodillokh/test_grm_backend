import { Module } from '@nestjs/common';
import { QrCodeService } from './qr-code.service';
import { QrCodeController } from './qr-code.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from './qr-code.entity';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [TypeOrmModule.forFeature([QrCode]), ProductModule],
  providers: [QrCodeService],
  controllers: [QrCodeController],
  exports: [QrCodeService],
})
export class QrCodeModule {}

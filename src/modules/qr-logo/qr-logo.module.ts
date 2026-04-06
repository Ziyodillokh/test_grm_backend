import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QrLogo } from './qr-logo.entity';
import { QrLogoService } from './qr-logo.service';
import { QrLogoController } from './qr-logo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QrLogo])],
  controllers: [QrLogoController],
  providers: [QrLogoService],
  exports: [QrLogoService],
})
export class QrLogoModule {}

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Color } from './color.entity';
import { ColorService } from './color.service';
import { ColorController } from './color.controller';
import { QrBaseModule } from '../qr-base/qr-base.module';

@Module({
  imports: [TypeOrmModule.forFeature([Color]), forwardRef(() => QrBaseModule)],
  controllers: [ColorController],
  providers: [ColorService],
  exports: [ColorService],
})
export class ColorModule {}

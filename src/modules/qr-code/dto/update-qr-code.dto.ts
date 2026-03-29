import { IsOptional } from 'class-validator';

export class UpdateQrCodeDto {
  @IsOptional()
  is_active?: boolean;

  @IsOptional()
  qr_base?: any;

  @IsOptional()
  product?: any;
}

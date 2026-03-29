// dto/create-transfer-cache.dto.ts
import { IsUUID, IsInt, IsNotEmpty } from 'class-validator';

export class CreateTransferCacheDto {
  @IsInt()
  count: number;

  @IsUUID()
  productId: string;

  @IsUUID()
  userId: string;
}

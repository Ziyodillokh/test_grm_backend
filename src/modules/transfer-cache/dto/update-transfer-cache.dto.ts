// dto/update-transfer-cache.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateTransferCacheDto } from './create-transfer-cache.dto';

export class UpdateTransferCacheDto extends PartialType(CreateTransferCacheDto) {}

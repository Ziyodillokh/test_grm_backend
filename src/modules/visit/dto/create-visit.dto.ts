import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateNoPurchaseVisitDto {
  @ApiProperty({ example: 'UUID' })
  @IsUUID('4')
  clientId: string;
}

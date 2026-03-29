import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CancelReportDto {
  @ApiProperty({ example: 'UUID', description: 'Kassa report ID' })
  @IsUUID('4')
  @IsNotEmpty()
  kassaReportId: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLogisticsDto {
  @ApiProperty({ description: 'Logistics company name' })
  @IsNotEmpty()
  @IsString()
  title: string;
}

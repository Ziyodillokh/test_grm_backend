import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCustomsDto {
  @ApiProperty({ description: 'Customs company name' })
  @IsNotEmpty()
  @IsString()
  title: string;
}

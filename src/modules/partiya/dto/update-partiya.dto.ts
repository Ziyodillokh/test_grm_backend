import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdatePartiyaDto {
  @ApiProperty({
    description: `country`,
    example: 'UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID(4)
  readonly country?: string;

  @ApiProperty({
    description: `expense : Расход:`,
    example: 8000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly expense?: number;

  @ApiProperty({
    description: `volume`,
    example: 8000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly volume?: number;

  @ApiProperty({
    description: 'date',
    required: false
  })
  @IsOptional()
  @IsString()
  readonly date: Date;

  @ApiProperty({
    description: `warehouse`,
    example: 'UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID(4)
  readonly warehouse?: string;

  @ApiProperty({
    description: `partiya no`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID('4')
  readonly partiya_no: string;

  @ApiProperty({
    description: `factory`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID('4')
  readonly factory: string;

  @ApiProperty({
    description: `user`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  readonly user: string;

  expensePerKv: number;
}

export default UpdatePartiyaDto;

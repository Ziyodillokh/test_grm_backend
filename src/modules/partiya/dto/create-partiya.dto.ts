import { IsDate, IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class CreatePartiyaDto {
  @ApiProperty({
    description: `country`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly country: string;

  @ApiProperty({
    description: `expense : Расход:`,
    example: 8000,
  })
  @IsNumber()
  readonly expense: number;

  @ApiProperty({
    description: `volume : объём:`,
    example: 800,
  })
  @IsNumber()
  readonly volume: number;

  @ApiProperty({
    description: `date`,
    example: 'Date',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  readonly date: string;

  @ApiProperty({
    description: `warehouse`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly warehouse: string;

  @ApiProperty({
    description: `partiya no`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsUUID('4')
  readonly partiya_no: string;

  @ApiProperty({
    description: `factory`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsUUID('4')
  readonly factory: string;

  @ApiProperty({
    description: `user`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly user: string;

  expensePerKv: number;
}

export default CreatePartiyaDto;

import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FilialTypeEnum } from 'src/infra/shared/enum';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';
import { Type } from 'class-transformer';

class CreateFilialDto {
  @ApiProperty({
    description: `title`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `name`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly name: string;

  @ApiProperty({
    description: `telegram link`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly telegram: string;

  @ApiProperty({
    description: `address`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly address: string;

  @ApiProperty({
    description: `address link`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly addressLink: string;

  @ApiProperty({
    description: `Landmark`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly landmark: string;

  @ApiProperty({
    description: `phone filial`,
    example: '+998',
  })
  @IsOptional()
  @IsString()
  readonly phone1: string;

  @ApiProperty({
    description: `second phone filial`,
    example: '+998',
  })
  @IsOptional()
  @IsString()
  readonly phone2: string;

  @ApiProperty({
    description: `Starting time`,
    example: '08:00',
  })
  @IsOptional()
  @IsString()
  readonly startWorkTime: string;

  @ApiProperty({
    description: `Ending time`,
    example: '18:00',
  })
  @IsOptional()
  @IsString()
  readonly endWorkTime: string;

  @IsOptional()
  @IsUUID('4')
  readonly manager: string;

  @ApiProperty({
    description: 'filial type',
    enum: FilialTypeEnum,
  })
  @IsEnum(FilialTypeEnum)
  type: FilialTypeEnum;

  order: number;
}

export default CreateFilialDto;

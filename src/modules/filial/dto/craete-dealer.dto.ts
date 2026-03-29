import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FilialTypeEnum } from 'src/infra/shared/enum';
import FilialType from '../../../infra/shared/enum/filial-type.enum';

class CreateDealerDto {
  @ApiProperty({
    description: `title`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `address`,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly address: string;

  @ApiProperty({
    description: `phone filial`,
    example: '+998',
  })
  @IsOptional()
  @IsString()
  readonly phone1: string;

  @IsOptional()
  @IsUUID('4')
  readonly manager: string;

  @ApiProperty({
    description: 'filial type',
    enum: FilialTypeEnum,
    default: FilialTypeEnum.DEALER,
  })
  @IsEnum(FilialTypeEnum)
  @IsOptional()
  type: FilialTypeEnum = FilialType.DEALER;

  @ApiProperty({ description: `first name`, example: 'qweewrterw', required: false })
  @IsOptional()
  @IsString()
  readonly firstName: string;

  @ApiProperty({ description: `last name`, example: 'qweretr', required: false })
  @IsOptional()
  @IsString()
  readonly lastName: string;

  @ApiProperty({ description: `father name`, example: '1231231231', required: false })
  @IsOptional()
  @IsString()
  readonly fatherName: string;

  @ApiProperty({ description: `login`, example: '1231231231', required: true })
  @IsOptional()
  @IsString()
  readonly login: string;

  password: string;
}

export default CreateDealerDto;

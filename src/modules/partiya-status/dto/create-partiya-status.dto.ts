import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { PartiyaStatusEnum } from '../../../infra/shared/enum';

class CreatePartiyaStatusDto {
  @ApiProperty({ example: 'New Partiya Status', description: 'The title of the partiya status' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: PartiyaStatusEnum.NEW,
    enum: PartiyaStatusEnum,
    description: 'The slug of the partiya status',
  })
  @IsEnum(PartiyaStatusEnum)
  slug: PartiyaStatusEnum;
}

export default CreatePartiyaStatusDto;
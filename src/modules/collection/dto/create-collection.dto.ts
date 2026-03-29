import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  Validate, IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUnique } from '../../../infra/shared/decorators/is-unique.decorator';
class CreateCollectionDto {
  @ApiProperty({
    description: `title`,
    example: 'SAG Carpets',
  })
  @IsNotEmpty()
  @IsString()
  @IsUnique('collection')
  readonly title?: string;

  @ApiProperty({
    description: `description`,
    example: 'SAG Carpets',
  })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiProperty({
    description: `UUID`,
    example: '',
  })
  @IsOptional()
  @IsUUID('4')
  readonly factory?: string;
}

export default CreateCollectionDto;

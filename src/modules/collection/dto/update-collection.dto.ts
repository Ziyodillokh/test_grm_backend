import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Factory } from '@modules/factory/factory.entity';
import { Country } from '@modules/country/country.entity';

class UpdateCollectionDto {
  @ApiProperty({
    description: `title`,
    example: 'SAG Carpets',
  })
  @IsOptional()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `description`,
    example: 'SAG Carpets',
  })
  @IsOptional()
  @IsString()
  readonly description: string;

  @ApiProperty({
    description: `UUID`,
    example: '',
  })
  @IsOptional()
  @IsUUID('4')
  factory?: string;

  @IsOptional()
  @IsUUID('4')
  country?: string;
}

export default UpdateCollectionDto;

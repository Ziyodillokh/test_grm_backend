import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export { default as CreateFactoryDto } from './create-factory..dto';
export { default as UpdateFactoryDto } from './update-factory.dto';
export { default as FactoryQueryDto } from './factory-query.dto';

export class connectFactoriesToCountry {
  @ApiProperty({
    description: `country id`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  countryId: string;

  @ApiProperty({
    description: 'factory ids',
    example: ['UUID', 'UUID'],
    isArray: true,
  })
  @IsNotEmpty()
  @IsArray()
  factories: string[];
}
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsUnique } from '../../../infra/shared/decorators/is-unique.decorator';

export { default as CreateCollectionDto } from './create-collection.dto';
export { default as UpdateCollectionDto } from './update-collection.dto';
export { default as TrCollectionDto } from './transfer.collection.query.dto';
export { default as QueryCollectionDto } from './colleciton-query.dto';


export class UpdateCollectionInfosDto {
  @ApiProperty({
    description: `factory UUID`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID('4')
  readonly factory: string;

  @ApiProperty({
    description: `country UUID`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID('4')
  readonly country: string;
}
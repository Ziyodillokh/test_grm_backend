import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUnique } from '../../../infra/shared/decorators/is-unique.decorator';

class CreateFactoryDto {
  @ApiProperty({
    description: `title`,
    example: 'SAG',
  })
  @IsNotEmpty()
  @IsString()
  @IsUnique('factory')
  readonly title: string;

  @ApiProperty({
    description: `UUID`,
    example: '',
  })
  @IsNotEmpty()
  @IsUUID('4')
  readonly country: string;

  @ApiProperty({
    required: false,
    description: 'Per-kv 3$ ayirilsin (sherikga foyda ulushiga ketadi)',
  })
  @IsOptional()
  @IsBoolean()
  readonly isPriceMinus3?: boolean;
}

export default CreateFactoryDto;

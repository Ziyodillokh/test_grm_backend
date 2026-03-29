import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUnique } from '../../../infra/shared/decorators/is-unique.decorator';

class UpdateFactoryDto {
  @ApiProperty({
    description: `title`,
    example: 'SAG',
  })
  @IsNotEmpty()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `UUID`,
    example: '',
  })
  @IsOptional()
  @IsUUID('4')
  readonly country: string;
}

export default UpdateFactoryDto;

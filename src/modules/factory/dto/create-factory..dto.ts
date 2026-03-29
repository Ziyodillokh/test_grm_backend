import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
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
}

export default CreateFactoryDto;

import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUnique } from 'src/infra/shared/decorators/is-unique.decorator';

class CreateColorDto {
  @ApiProperty({
    description: `title`,
    example: 'Red',
  })
  @IsNotEmpty()
  @IsString()
  @IsUnique('color')
  readonly title: string;
}

export default CreateColorDto;

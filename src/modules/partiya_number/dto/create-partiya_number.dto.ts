import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreatePartiyaNumberDto {
  @ApiProperty({
    description: `title`,
    example: 'SAG',
  })
  @IsNotEmpty()
  @IsString()
  readonly title: string;
}

export default CreatePartiyaNumberDto;
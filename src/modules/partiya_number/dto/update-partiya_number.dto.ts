import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdatePartiyaNumberDto {
  @ApiProperty({
    description: `title`,
    example: 'SAG',
  })
  @IsNotEmpty()
  @IsString()
  readonly title: string;
}

export default UpdatePartiyaNumberDto;
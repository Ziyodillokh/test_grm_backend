import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateFileDto {
  @ApiProperty({
    description: `Collection`,
    example: 'Afra',
  })
  @IsOptional()
  @IsString()
  readonly collection?: string;

  @ApiProperty({
    description: `Model`,
    example: 5465,
  })
  @IsOptional()
  @IsString()
  readonly model?: string;

  @ApiProperty({
    description: `Color`,
    example: 'Yellow',
  })
  @IsOptional()
  @IsString()
  readonly color?: string;

  @ApiProperty({
    description: `shape`,
    example: 'rectangle',
  })
  @IsOptional()
  @IsString()
  readonly shape?: string;

  @ApiProperty({
    description: `Url`,
    example: 'https://grm.uz/example.jpg',
  })
  @IsOptional()
  @IsString()
  readonly url: string;
}

export default UpdateFileDto;

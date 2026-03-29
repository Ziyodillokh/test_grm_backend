import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Media } from '../../media/media.entity';

class CreateFileDto {
  @ApiProperty({
    description: `Model`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly model: string;

  @ApiProperty({
    description: `Color`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly color: string;

  @ApiProperty({
    description: `collection`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly collection: string;

  @ApiProperty({
    description: `shape`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly shape: string;

  @ApiProperty({
    description: `img`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly img: Media;

  @ApiProperty({
    description: `is_video`,
    example: false,
  })
  @IsOptional()
  @IsString()
  readonly is_video: boolean;
}

export default CreateFileDto;

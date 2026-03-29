import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAwardDto {
  @ApiProperty({ example: 'Best Employee' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  sum: number;
}

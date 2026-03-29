import { IsNotEmpty, IsOptional, IsUUID, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
class CreateKassaDto {
  @ApiProperty({
    description: `filial id`,
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('4')
  readonly filial: string;

  @ApiPropertyOptional({ description: 'Year override' })
  @IsOptional()
  @IsInt()
  readonly year?: number;

  @ApiPropertyOptional({ description: 'Month override (1-12)' })
  @IsOptional()
  @IsInt()
  readonly month?: number;
}

export default CreateKassaDto;

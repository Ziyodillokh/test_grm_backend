import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Position } from '../../position/position.entity';

class UpdateCashflowTypeDto {
  @ApiPropertyOptional({ example: 'Income', description: 'Title of the cashflow type' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'income', description: 'Slug for the cashflow type' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    example: '[{"id": "UUID"}, {"id": "UUID"}]',
    description: 'Position ids',
    required: false,
  })
  @IsOptional()
  @IsArray()
  positions?: Position[];

  @ApiPropertyOptional({ example: 'income', description: 'Slug for the cashflow type' })
  @IsOptional()
  @IsUUID('4')
  icon?: string;
}

export default UpdateCashflowTypeDto;
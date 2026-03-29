import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class CloseKassaDto {
  @ApiProperty({
    description: `Kassa IDs (must be UUIDs)`,
    example: ['550e8400-e29b-41d4-a716-446655440000', '123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsNotEmpty()
  @IsArray()
  @IsUUID('all', { each: true }) // Ensures each item in the array is a valid UUID
  readonly ids: string[];
}

export default CloseKassaDto;

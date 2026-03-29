import { IsString, IsOptional, IsNumber, IsDateString, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDiscountDto {
  @ApiProperty({
    description: 'Discount title',
    example: 'Summer Sale 2025',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Discount amount (0-100)',
    example: 5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercentage: number;

  discountSum: number;

  @ApiProperty({
    description: 'isActive',
    example: 'false',
    required: false,
  })
  @IsBoolean()
  isAdd?: boolean;
}

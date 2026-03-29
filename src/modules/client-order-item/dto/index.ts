import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateClientOrderItemDto {
  @ApiProperty({
    description: `product`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly product: string;

  @ApiProperty({
    description: `count`,
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly count: number;
}

export class UpdateClientOrderItemDto {
  @ApiProperty({
    description: `count`,
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly count: number;
}
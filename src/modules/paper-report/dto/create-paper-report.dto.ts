import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreatePaperReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(0)
  kv: number;

  @IsOptional()
  filialId: string;
}

export interface PaperReportFilters {
  year?: number;
  month?: number;
  filialId?: string;
}

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = parseInt(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

export class PaperReportFiltersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  @Max(3000)
  @Transform(({ value }) => parseInt(value))
  year?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Transform(({ value }) => parseInt(value))
  month?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  filialId?: string;

  @ApiProperty({
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number = 1;
}

export class GetSavdoNarxiExcelDto {
  @IsNotEmpty()
  @Type(() => Number)
  year: number;

  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month: number;
}

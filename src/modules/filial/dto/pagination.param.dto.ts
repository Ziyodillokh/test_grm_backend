import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

class PaginationParamsDto {
  @Type(() => Number)
  @IsNumber()
  page: number = 1;

  @Type(() => Number)
  @IsNumber()
  limit: number = 10;
}
export default PaginationParamsDto;

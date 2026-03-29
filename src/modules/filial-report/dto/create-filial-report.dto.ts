import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { FilialReportStatusEnum } from '../../../infra/shared/enum';

class CreateFilialReportDto {
  @IsDateString()
  date?: string;

  @IsNumber()
  volume: number;

  @IsNumber()
  cost: number;

  @IsOptional()
  @IsString()
  excel?: string;

  @IsUUID()
  filial: string;

  status?: FilialReportStatusEnum
}

export default CreateFilialReportDto;
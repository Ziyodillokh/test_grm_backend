import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { FilialReportStatusEnum } from '../../../infra/shared/enum';

class CreateFilialReportDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  volume?: number;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  excel?: string;

  @IsUUID()
  filial: string;

  @IsOptional()
  status?: FilialReportStatusEnum;
}

export default CreateFilialReportDto;
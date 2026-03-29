import { PartialType } from '@nestjs/mapped-types';
import CreateFilialReportDto from './create-filial-report.dto';

class UpdateFilialReportDto extends PartialType(CreateFilialReportDto) {
}

export default UpdateFilialReportDto;
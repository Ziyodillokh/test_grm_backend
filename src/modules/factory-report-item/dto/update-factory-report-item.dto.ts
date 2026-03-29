import { PartialType } from '@nestjs/swagger';
import { CreateFactoryReportItemDto } from './create-factory-report-item.dto';

export class UpdateFactoryReportItemDto extends PartialType(CreateFactoryReportItemDto) {}

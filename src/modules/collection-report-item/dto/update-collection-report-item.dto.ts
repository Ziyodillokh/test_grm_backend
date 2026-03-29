import { PartialType } from '@nestjs/swagger';
import { CreateCollectionReportItemDto } from './create-collection-report-item.dto';

export class UpdateCollectionReportItemDto extends PartialType(CreateCollectionReportItemDto) {}

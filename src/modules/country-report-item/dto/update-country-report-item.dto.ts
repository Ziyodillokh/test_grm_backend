import { PartialType } from '@nestjs/swagger';
import {  CreateCountryReportItemDto } from './create-country-report-item.dto';

export class UpdateCountryReportItemDto extends PartialType(CreateCountryReportItemDto) {}

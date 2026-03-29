import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';

@ApiTags('Product History')
@Controller('product-report')
export class ProductReportController {
  constructor() {
  }
}
import { PartialType } from '@nestjs/swagger';
import  CreatePayrollItemDto  from './create-payroll-item.dto';

export default class UpdatePayrollItemDto extends PartialType(CreatePayrollItemDto) {}

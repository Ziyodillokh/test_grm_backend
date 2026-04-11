import { PartialType } from '@nestjs/swagger';
import { CreateCustomsDto } from './create-customs.dto';

export class UpdateCustomsDto extends PartialType(CreateCustomsDto) {}

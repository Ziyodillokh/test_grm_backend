import { PartialType } from '@nestjs/swagger';
import { CreateStreetDto } from './create-street.dto';

export class UpdateStreetDto extends PartialType(CreateStreetDto) {}

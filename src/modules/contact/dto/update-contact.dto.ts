import { PartialType } from '@nestjs/swagger';
import CreateContactDto from './create-contact.dto';

class UpdateContactDto extends PartialType(CreateContactDto) {}

export default UpdateContactDto;
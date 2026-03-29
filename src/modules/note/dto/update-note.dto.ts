// src/note/dto/update-note.dto.ts
import { PartialType } from '@nestjs/swagger';
import CreateNoteDto from './create-note.dto';

class UpdateNoteDto extends PartialType(CreateNoteDto) {
}

export default UpdateNoteDto;
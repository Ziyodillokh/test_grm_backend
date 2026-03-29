// src/note/dto/create-note.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

class CreateNoteDto {
  @ApiProperty({ example: 'Important Task', description: 'Unique title of the note' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'red', description: 'Color of the note' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ example: 'This is the content of the note.', description: 'Full text of the note' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export default CreateNoteDto
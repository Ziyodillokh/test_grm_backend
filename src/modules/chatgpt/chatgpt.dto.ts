// src/chat/dto/create-chat.dto.ts
// src/chat/dto/update-chat.dto.ts
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  prompt: string;
}

export class UpdateChatDto extends PartialType(CreateChatDto) {
}

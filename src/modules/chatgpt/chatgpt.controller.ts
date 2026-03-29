// src/modules/chatgpt/chatgpt.controller.ts
import { Body, Controller, Delete, Get, Post, Query, Request, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ChatGptService } from './chatgpt.service';
import { CreateChatDto } from './chatgpt.dto';
import { ApiProperty, ApiTags } from '@nestjs/swagger';

@ApiTags('ChatGPT')
@Controller('chatgpt')
export class ChatGptController {
  constructor(private readonly chatGptService: ChatGptService) {}

  @ApiProperty()
  @Post('stream')
  async streamChat(@Body() body: CreateChatDto, @Request() req, @Res() res: Response) {
    return this.chatGptService.streamAndSave(body.prompt, req.user, res);
  }

  @ApiProperty()
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    return this.chatGptService.transcribeAudio(file);
  }

  @ApiProperty()
  @Post('tts')
  async tts(@Body() body: { text: string }, @Res() res: Response) {
    return this.chatGptService.textToSpeech(body.text, res);
  }

  @ApiProperty()
  @Delete('history')
  async clearHistory(@Request() req) {
    return this.chatGptService.clearUserHistory(req.user);
  }

  @ApiProperty()
  @Get()
  async history(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const user = req.user;
    return this.chatGptService.findAllByUserPaginated(user, {
      page: Number(page),
      limit: Number(limit),
      route: '/chatgpt',
    });
  }
}

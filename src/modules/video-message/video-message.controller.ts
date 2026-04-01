import { Controller, Get, Post, Delete, Param, Body, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';

import { VideoMessageService } from './video-message.service';
import { CreateVideoMessageDto } from './dto/create-video-message.dto';
import { VideoMessage } from './video-message.entity';

@ApiTags('Video Messages')
@Controller('video-messages')
export class VideoMessageController {
  constructor(private readonly videoMessageService: VideoMessageService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns video messages visible to current user' })
  @ApiOkResponse({ description: 'Video messages returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findAll(@Request() req): Promise<VideoMessage[]> {
    const userId = req.user.id;
    const userRole = req.user.position?.role;
    return this.videoMessageService.findAll(userId, userRole);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single video message by id' })
  @ApiOkResponse({ description: 'Video message returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<VideoMessage> {
    return this.videoMessageService.findOne(id);
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: creates new video message' })
  @ApiCreatedResponse({ description: 'Video message created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateVideoMessageDto, @Request() req): Promise<VideoMessage> {
    return this.videoMessageService.create(dto, req.user.id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deletes video message (soft delete)' })
  @ApiOkResponse({ description: 'Video message deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.videoMessageService.delete(id);
  }
}

import {
  Controller, Get, Post, Delete, Param, Body, Request,
  HttpCode, HttpStatus, UseInterceptors, UploadedFile, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiConsumes } from '@nestjs/swagger';

import { VideoMessageService } from './video-message.service';
import { CreateVideoMessageDto } from './dto/create-video-message.dto';
import { VideoMessage } from './video-message.entity';
import { MinioClientService } from '../minio-client/minio-client.service';
import { BufferedFile } from '../minio-client/interface';

@ApiTags('Video Messages')
@Controller('video-messages')
export class VideoMessageController {
  constructor(
    private readonly videoMessageService: VideoMessageService,
    private readonly minioClientService: MinioClientService,
  ) {}

  @Get('/')
  @ApiOperation({ summary: 'Get video messages visible to current user' })
  @HttpCode(HttpStatus.OK)
  async findAll(@Request() req): Promise<VideoMessage[]> {
    const userId = req.user.id;
    const userRole = req.user.position?.role;
    return this.videoMessageService.findAll(userId, userRole);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get single video message' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<VideoMessage> {
    return this.videoMessageService.findOne(id);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create video message (JSON body)' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateVideoMessageDto, @Request() req): Promise<VideoMessage> {
    return this.videoMessageService.create(dto, req.user.id);
  }

  @Post('/upload')
  @ApiOperation({ summary: 'Upload video and create message in one step' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('video'))
  @HttpCode(HttpStatus.CREATED)
  async uploadAndCreate(
    @UploadedFile() file: BufferedFile,
    @Body() body: { targetRole?: string; targetUserId?: string; title?: string },
    @Request() req,
  ): Promise<VideoMessage> {
    // 1. Upload to MinIO
    const { path } = await this.minioClientService.upload(
      file,
      'video-messages' as any,
    );

    // 2. Create video message record
    return this.videoMessageService.create(
      {
        videoPath: path,
        title: body.title || file.originalname,
        targetRole: body.targetRole ? Number(body.targetRole) : undefined,
        targetUserId: body.targetUserId && body.targetUserId !== 'all' ? body.targetUserId : undefined,
      },
      req.user.id,
    );
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete video message (soft delete)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.videoMessageService.delete(id);
  }
}

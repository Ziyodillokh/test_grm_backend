import { Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MediaService } from './media.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BufferedFile } from '../minio-client/interface';
import { Public } from '../auth/decorators/public.decorator';
import { MinioClientService } from '../minio-client/minio-client.service';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MediaBucket } from '../../infra/shared/enum';

@ApiTags('Media-Upload')
@Controller('media-upload')
export class MediaController {
  constructor(
    private mediaService: MediaService,
    private minioClientService: MinioClientService,
  ) {
  }

  @Post('single/:folder/:type')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a single Excel file and return converted JSON data',
  })
  @ApiParam({
    name: 'folder',
    required: true,
    description: 'The target model/folder to associate the uploaded file with',
  })
  @ApiParam({
    name: 'type',
    required: true,
    description: 'Media bucket type (e.g., documents, images, etc.)',
    enum: MediaBucket,
  })
  @ApiBody({
    description: 'Excel file to upload',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'The Excel file to upload',
        },
      },
      required: ['image'],
    },
  })
  @ApiCreatedResponse({
    description: 'The Excel file was uploaded and converted to JSON successfully',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'object',
          description: 'Uploaded image metadata stored in the database',
          properties: {
            id: { type: 'string' },
            path: { type: 'string' },
            model: { type: 'string' },
            size: { type: 'number' },
            mimetype: { type: 'string' },
            name: { type: 'string' },
          },
        },
        message: {
          type: 'string',
          example: 'Successfully uploaded to MinIO S3',
        },
      },
    },
  })
  async uploadSingle(
    @UploadedFile() image: BufferedFile,
    @Param('folder') folder: string,
    @Param('type') type: MediaBucket,
    @Query() query: {qrbase: string}
  ) {
    const { path, name, url } = await this.minioClientService.upload(image, type);

    const res = await this.mediaService.create({
      path,
      model: folder,
      size: image.size,
      mimetype: image.mimetype,
      name,
      ...(query?.qrbase && {i_image: query.qrbase})
    });

    return res;
  }


  @Public()
  @Get('/test')
  async checkMinio() {
    await this.minioClientService.testConnection();

    return 'ok';
  }
}
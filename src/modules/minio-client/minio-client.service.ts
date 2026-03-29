import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import Config from '../../../config';
import { BufferedFile } from './interface';
import * as crypto from 'crypto';
import { MediaBucket } from '../../infra/shared/enum';

@Injectable()
export class MinioClientService {
  private readonly logger: Logger;
  private readonly baseBucket = Config().minIO.BUCKET;
  private readonly config = Config().minIO;
  constructor(
    private readonly minio: MinioService,
  ) {
    this.logger = new Logger('MinioStorageService');
  }


  public get client() {
    return this.minio.client;
  }


  public async upload(file: BufferedFile, baseBucket: MediaBucket = this.baseBucket) {
    console.log('baseBucket', baseBucket);
    this.logger.log('Uploading file...');

    const temp_filename = Date.now().toString();
    const hashedFileName = crypto.createHash('md5').update(temp_filename).digest('hex');
    const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
    const metaData = { 'Content-Type': file.mimetype };
    const fileName = `${hashedFileName}${ext}`;
    const fileBuffer = file.buffer;

    console.log('Uploading file to bucket:', baseBucket);
    console.log('FileName:', fileName);
    console.log('FileSize:', fileBuffer.length);
    console.log('MetaData:', metaData);


    try {
      await this.client.putObject(baseBucket, fileName, fileBuffer, fileBuffer.length, metaData);
      this.logger.log(`File uploaded successfully: ${fileName}`);
    } catch (err) {
      console.log(err);
      this.logger.error(`Failed to upload file: ${err.message}`);
      throw new HttpException('Failed to upload file', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const protocol = this.config.ENDPOINT.startsWith('https') ? 'https' : 'http';
    return {
      url: `${protocol}://${this.config.ENDPOINT}/${baseBucket}/${fileName}`,
      path: `/${baseBucket}/${fileName}`,
      name: file.originalname
    };
  }

  async delete(objectName: string, baseBucket: string = this.baseBucket) {
    try {
      await this.client.removeObject(baseBucket, objectName);
    } catch (err) {
      throw new HttpException('Oops! Something went wrong', HttpStatus.BAD_REQUEST);
    }
  }

  async testConnection() {
    try {
      const buckets = await this.client.listBuckets();
      console.log('MinIO is reachable. Buckets:', buckets);
    } catch (err) {
      console.error('Failed to connect to MinIO:', err.message);
    }
  }

}
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { MinioClientService } from '../minio-client/minio-client.service';
import media_busket from '../../infra/shared/enum/media.enum';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly minioClient: MinioClientService) {
  }

  async backupDatabase() {
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${date}.sql`;

    // 🔁 Cross-platform temporary directory
    const tmpDir = path.join(process.cwd(), 'tmp'); // or use os.tmpdir()

    // ❗ Ensure the tmp folder exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const filePath = path.join(tmpDir, fileName);

    const {
      DB_NAME,
      DB_USERNAME,
      DB_PASSWORD,
      DB_HOST,
      DB_PORT,
    } = process.env;

    if (!DB_NAME || !DB_USERNAME || !DB_PASSWORD || !DB_HOST || !DB_PORT) {
      this.logger.error('❌ Missing PostgreSQL environment variables');
      return;
    }

    const cmd = `pg_dump -h ${DB_HOST} -U ${DB_USERNAME} -p ${DB_PORT} -d ${DB_NAME} -F c -f "${filePath}"`;

    try {
      this.logger.log('Creating PostgreSQL backup...');

      // 💡 PGPASSWORD passed through env
      await execAsync(cmd, {
        env: {
          ...process.env,
          PGPASSWORD: DB_PASSWORD,
        },
      });

      const buffer = fs.readFileSync(filePath);

      await this.minioClient.upload(
        {
          buffer,
          originalname: fileName,
          mimetype: 'application/octet-stream',
          fieldname: 'file',
          encoding: '7bit',
          size: buffer.length,
        },
        media_busket.backup,
      );

      this.logger.log(`✅ Backup uploaded to MinIO successfully: ${fileName}`);
    } catch (error) {
      this.logger.error(`❌ Backup failed: ${error.message}`);
    } finally {
      // 🧹 Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

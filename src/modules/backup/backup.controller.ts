import { Controller, Get } from '@nestjs/common';
import { BackupService } from './backup.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiProperty, ApiTags } from '@nestjs/swagger';

@ApiTags('Backup')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {
  }

  @ApiProperty()
  @Get('run')
  async runBackup() {
    return this.backupService.backupDatabase();
  }
}

import { ApiBearerAuth, ApiConsumes, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { RestoreService } from './restore.service';
import { Public } from '../auth/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerStorage } from '../../infra/helpers';
import { Body } from '@nestjs/common/decorators';
import { ImportExcelDto } from '../excel/dto';

@ApiTags('Restore')
@ApiBearerAuth()
@Controller('restore')
export class RestoreController {
  constructor(private readonly restoreService: RestoreService) {}

  @Post('/')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Method: imports excel file and returns json data' })
  @ApiCreatedResponse({
    description: 'The excel file imported and converted to json successfully',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorage('uploads/excel'),
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async createExcel(@UploadedFile() file: Express.Multer.File, @Body() bodyData: ImportExcelDto) {
    const data = this.restoreService.readExcelFile(file.path, 'CashFlow Malumotlari');

    return await this.restoreService['createOrder&cashflow'](data);
  }
}

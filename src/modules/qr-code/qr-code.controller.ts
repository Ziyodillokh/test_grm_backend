import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { QrCodeService } from './qr-code.service';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QrCode } from './qr-code.entity';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Public } from '../auth/decorators/public.decorator';
import { Put } from '@nestjs/common/decorators';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '../../infra/shared/enum';
import { UpdateQrCodeDto } from './dto/update-qr-code.dto';

@ApiTags('QR Codes')
@Controller('qr-codes')
export class QrCodeController {
  constructor(private readonly qrCodeService: QrCodeService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Generate and save a new QR code' })
  @ApiResponse({ status: 201, description: 'QR code generated successfully', type: QrCode })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 2 },
      },
    },
  })
  async generateQr(@Body() body) {
    return this.qrCodeService.generateAndSaveQrCode(body.count);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all QR codes with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated QR codes' })
  async getAll(
    @Query('page', new ParseIntPipe()) page = 1,
    @Query('limit', new ParseIntPipe()) limit = 10,
  ): Promise<Pagination<QrCode>> {
    return this.qrCodeService.findAll({ page, limit });
  }

  @Patch(':id')
  async updateQrCode(@Param('id') id: string, @Body() updateData: UpdateQrCodeDto) {
    return await this.qrCodeService.update(id, updateData);
  }

  @Patch('sequence/:sequence')
  async updateBySequence(@Param('sequence') sequence: number, @Body() updateData: UpdateQrCodeDto) {
    return await this.qrCodeService.updateBySequence(sequence, updateData);
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return await this.qrCodeService.toggleActiveStatus(id);
  }

  @Public()
  @Patch('clear')
  @ApiOperation({ summary: 'Get all QR codes with pagination' })
  async clearQrCode() {
    await this.qrCodeService.clear();
    return { data: null, success: true };
  }

  @Public()
  @Put(':id')
  @ApiOperation({ summary: 'Get all QR codes with pagination' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bar_code: { type: 'string', example: 'UUID' },
        product: { type: 'string', example: 'UUID' },
      },
    },
  })
  async connectProduct(@Param('id') id: string, @Body() body: { bar_code: string; product: string }) {
    return await this.qrCodeService.connectProduct(id, body.bar_code, body.product);
  }

  @Put('product/connect/:id')
  @ApiOperation({ summary: 'Get all QR codes with pagination' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bar_code: { type: 'string', example: 'UUID' },
      },
    },
  })
  async connectProductWithBarcode(@Param('id') id: string, @Body() body: { bar_code: string }, @Req() req) {
    return await this.qrCodeService.findByQrBase(body.bar_code, req.user.filial.id, id);
  }
}

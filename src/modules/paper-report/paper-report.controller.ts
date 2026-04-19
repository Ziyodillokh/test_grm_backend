import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { PaperReportService } from './paper-report.service';
import { CreatePaperReportDto, PaperReportFiltersDto } from './dto/create-paper-report.dto';
import { UpdatePaperReportDto } from './dto/update-paper-report.dto';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

@ApiTags('Paper Report')
@Controller('paper-report')
export class PaperReportController {
  constructor(private readonly paperReportService: PaperReportService) {}
  @Post()
  @ApiOperation({ summary: 'Method: creating paper report' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPaperReportDto: CreatePaperReportDto) {
    return await this.paperReportService.create(createPaperReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Method: getting all paper reports' })
  async findAll(@Query() filters: PaperReportFiltersDto, @Query() paginationOptions: IPaginationOptions) {
    return await this.paperReportService.findAll(filters, paginationOptions);
  }

  @Get('stats')
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2025 })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 8, description: "1-12 oralig'ida bo'lishi kerak" })
  async getStats(
    @Query('filialId') filialId: string | undefined,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    return this.paperReportService.getMonthlyStatsByFilial(filialId || null, year, month);
  }

  @Get('array/get-all-types')
  async getArray() {
    return this.paperReportService.getArray();
  }

  @Get('export-excel')
  @ApiOperation({
    summary: 'Export combined reports to Excel',
    description: 'Oylik hisobot va paper reports birlashtirilgan Excel fayli',
  })
  @ApiQuery({ name: 'year', required: true, type: Number, description: 'Yil', example: 2024 })
  @ApiQuery({ name: 'month', required: true, type: Number, description: 'Oy (1-12)', example: 1 })
  @ApiQuery({ name: 'filialId', required: false, type: String, description: 'Filial ID (ixtiyoriy)' })
  async exportExcel(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('filialId') filialId?: string,
    @Res() res?: Response,
  ) {
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new BadRequestException("Noto'g'ri parametrlar");
    }

    const { arrayBuffer, headName, monthText } =
      await this.paperReportService.generateCustomExcel({
        filialId,
        year: yearNum,
        month: monthNum,
      });

    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${headName} hisobot ${year} - ${monthText}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Content-Length', buffer.byteLength);

    res.end(buffer);
  }

  @Get('universal-excel')
  @ApiQuery({
    name: 'tur',
    required: true,
    enum: [
      'savdoNarxi',
      'kelganQarzlar',
      'saldo',
      'terminal',
      'inkasatsiya',
      'naqdKassa',
      'countrySales',
      'dillerNaqd',
      'dillerTerminal',
      'zavodFoyda1',
      'kolleksiyaFoyda1',
      'boss',
      'qarzgaSotilgan',
      'qaytganTovarlar',
      'skidka',
      'biznesRasxod',
      'postavshik',
      'customs',
      'qarzlar',
    ],
  })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiOperation({ summary: 'Universal Excel hisobot (tur orqali barcha turlar uchun)' })
  async getUniversalExcel(
    @Query('tur') tur: string,
    @Query('filialId') filialId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Res() res?: Response,
  ) {
    // Validation
    if (!tur || !year || !month) {
      throw new BadRequestException('tur, year va month majburiy!');
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Year va month validation
    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new BadRequestException("year va month raqam bo'lishi kerak!");
    }

    if (yearNum < 2020 || yearNum > 2030) {
      throw new BadRequestException("year 2020-2030 oralig'ida bo'lishi kerak!");
    }

    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException("month 1-12 oralig'ida bo'lishi kerak!");
    }

    // Valid tur types
    const validTurs = [
      'savdoNarxi',
      'kelganQarzlar',
      'saldo',
      'terminal',
      'inkasatsiya',
      'naqdKassa',
      'countrySales',
      'dillerNaqd',
      'dillerTerminal',
      'zavodFoyda1',
      'kolleksiyaFoyda1',
      'boss',
      'qarzgaSotilgan',
      'qaytganTovarlar',
      'skidka',
      'biznesRasxod',
      'postavshik',
      'customs',
      'qarzlar',
    ];

    if (!validTurs.includes(tur)) {
      throw new BadRequestException(`tur qiymati noto'g'ri! Mavjud turlar: ${validTurs.join(', ')}`);
    }

    try {
      const result = await this.paperReportService.exportUniversalExcel(tur as any, filialId, yearNum, monthNum);

      // Set headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      res.setHeader('Content-Length', result.buffer.length.toString());

      // Send buffer
      return res.send(result.buffer);
    } catch (error) {
      throw new BadRequestException(`Excel yaratishda xatolik: ${error.message}`);
    }
  }


  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @Get('excel-new/new')
  async getExcel(
    @Query('filialId') filialId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Res() res?: Response,
  ) {
    const { arrayBuffer, headName, monthText } =
      await this.paperReportService.generateCustomExcel({
        filialId,
        year: Number(year),
        month: Number(month),
      });

    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${headName} hisobot ${year} - ${monthText}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Content-Length', buffer.byteLength);

    res.end(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paperReportService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePaperReportDto) {
    return this.paperReportService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paperReportService.remove(id);
  }
}

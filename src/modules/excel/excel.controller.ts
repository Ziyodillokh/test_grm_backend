import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import * as path from 'path';
import { existsSync } from 'fs';
import * as AdmZip from 'adm-zip';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ExcelService } from './excel.service';
import { multerStorage } from '../../infra/helpers';
import { Public } from '../auth/decorators/public.decorator';
import { Body, Delete, Get, Put, Res } from '@nestjs/common/decorators';
import {
  GetProductReportDto,
  ImportExcelDto,
  UpdateCollectionCostDto,
  UpdateModelCostDto,
  UpdateProductExcelDto,
} from './dto';
import CreateProductExcDto from './dto/createProduct-excel';
import { CreateQrBaseDto } from '../qr-base/dto';
import { PartiyaProductsEnum, ProductReportEnum } from '../../infra/shared/enum';
import { Response } from 'express';

@ApiTags('Excel')
@Controller('excel')
export class ExcelController {
  constructor(private readonly fileService: ExcelService) { }
  
  @Get('partiya-export')
  @ApiOperation({ summary: "Partiya ma'lumotlarni Excel formatida export qilish" })
  @ApiQuery({ name: 'filialId', required: true })
  @ApiResponse({ status: 200 })
  async exportPartiyaToExcel(@Res() res: Response, @Query('filialId') filialId: string) {
    return await this.fileService.getPartiyaExcel(filialId, res);
  }

  @Patch('/change-count/:id')
  @ApiOperation({
    summary: '',
  })
  @HttpCode(HttpStatus.OK)
  async updateCount(@Param('id') id: string, @Query('tip') tip: ProductReportEnum) {
    console.log('id=============>', id);
    return await this.fileService.updateCount(id, tip);
  }

  @Post('/zip')
  @ApiOperation({
    summary: 'dfasdfadgafgasdfasdfasd',
  })
  @ApiCreatedResponse({
    description: 'asdsfgasdfasdfasdf',
  })
  @HttpCode(HttpStatus.OK)
  async getExcel(@Body() Body: object[], @Res() res) {
    const response = await this.fileService.createExcelFile(Body, 'accounting');
    const pathfile = path.join(process.cwd(), 'uploads', 'accounting');
    if (existsSync(pathfile)) {
      const zip = new AdmZip();
      await zip.addLocalFolder(pathfile);
      const response = await zip.toBuffer();
      const fileName = 'backup.zip';
      const fileType = 'application/zip';

      res.writeHead(200, {
        'Content-Disposition': `attachment; filename="${fileName}`,
        'Content-Type': fileType,
      });

      return res.end(response);
    } else return { data: null, isNaN: true };
  }

  @Public()
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
    const data = this.fileService.readExcelFile(file.path);

    console.log(data.length);
    console.log(bodyData.partiyaId, '         <========================');
    return await this.fileService.addProductToPartiyaWithExcel(data, bodyData.partiyaId);
  }

  @Public()
  @Post('/single/:id')
  @ApiOperation({
    summary: 'Method: imports data and update products in the excel',
  })
  @ApiCreatedResponse({
    description: 'The data imported and saved to partiya successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Param('id') id: string, @Body() data: CreateProductExcDto) {
    return await this.fileService.addProductToPartiya([data], id);
  }

  @Get('/products')
  @ApiOperation({
    summary: '',
  })
  @ApiCreatedResponse({
    description: '',
  })
  @ApiQuery({
    name: 'type',
    enum: PartiyaProductsEnum,
    required: true,
  })
  @ApiQuery({
    name: 'tip',
    enum: ProductReportEnum,
    required: true,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: true,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: true,
  })
  @ApiQuery({
    name: 'text',
    type: 'string',
    required: false,
  })
  @ApiQuery({
    name: 'partiyaId',
    type: 'string',
    required: false,
  })
  @HttpCode(HttpStatus.OK)
  async GetAllProducts(
    @Query('type') type: PartiyaProductsEnum,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('partiyaId') partiyaId: string,
    @Query('tip') tip: ProductReportEnum,
  ) {
    page = Number(page) || 1;
    limit = Number(limit) || 10;
    return await this.fileService.getAll({ page, limit }, type, search, partiyaId, tip);
  }

  @Get('/products/report')
  @HttpCode(HttpStatus.OK)
  async getProductReport(@Query() query: GetProductReportDto) {
    return this.fileService.getReport(query.partiyaId, query.tip);
  }

  @Public()
  @Get('/:id')
  @ApiOperation({
    summary: 'Method: imports data and update products in the excel',
  })
  @ApiCreatedResponse({
    description: 'The data imported and saved to partiya successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async GetProducts(@Param('id') id: string, @Query('search') search: string) {
    console.log('search ========>', search);
    return await this.fileService.readProducts(id, search);
  }

  @Patch('/finish/:id')
  @ApiOperation({
    summary: 'Method: imports data and update products in the excel',
  })
  @HttpCode(HttpStatus.OK)
  async finish(@Param('id') id: string) {
    return await this.fileService.createProducts(id);
  }

  @Public()
  @Put('/single/:id')
  @ApiOperation({
    summary: 'Method: imports data and update products in the excel',
  })
  @ApiCreatedResponse({
    description: 'The data imported and saved to partiya successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async updateProduct(@Param('id') id: string, @Body() data: UpdateProductExcelDto) {
    return await this.fileService.updateProduct(data, id);
  }

  @Post('/product/:partiyaId')
  @ApiOperation({
    summary: 'Method: imports data and update products in the baza',
  })
  @ApiCreatedResponse({
    description: 'The data imported and saved to baza successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async CreateProduct(@Param('partiyaId') id: string, @Body() data) {
    return await this.fileService.createExcessProduct({ ...data, partiyaId: id });
  }

  @Public()
  @Get('/product/:id')
  @ApiOperation({
    summary: 'Method: Get product by id with params',
  })
  @ApiCreatedResponse({
    description: 'The data come successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async getOneProduct(@Param('id') id: string) {
    const response = await this.fileService.getOne(id);

    return response;
  }

  @Public()
  @Delete('/product/:id')
  @ApiOperation({
    summary: 'Method: Get product by id with params',
  })
  @ApiCreatedResponse({
    description: 'The data come successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async DeleteProduct(@Param('id') id: string) {
    const response = await this.fileService.delete(id);

    return response;
  }

  @Public()
  @Post('/qr-code/:id')
  @ApiOperation({
    summary: 'Method: imports data and update products in the baza',
  })
  @ApiCreatedResponse({
    description: 'The data imported and saved to baza successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async CreateProductsQr(@Param('id') id: string, @Body() data: CreateQrBaseDto) {
    const response = await this.fileService.createWithCode(data, id);

    return response;
  }

  @Public()
  @Get('/qr-code/:id/:code')
  @ApiOperation({
    summary: 'Method: imports data and update products in the baza',
  })
  @ApiCreatedResponse({
    description: 'The data imported and saved to baza successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async CHechQr(@Param('code') code: string, @Param('id') id: string) {
    const response = await this.fileService.checkProductCode({ code, id });

    return response;
  }

  @Put('/collection/:id')
  @ApiOperation({
    summary: '',
  })
  @ApiCreatedResponse({
    description: '',
  })
  @HttpCode(HttpStatus.OK)
  async updateCollectionCost(@Param('id') id: string, @Body() datas: UpdateCollectionCostDto[]) {
    for (const data of datas) {
      await this.fileService.updateCollectionCost({
        id: data.collectionId,
        cost: data.cost,
        partiyaId: id,
      });
    }

    return 'Changed';
  }

  @Put('/model/:id')
  @ApiOperation({
    summary: '',
  })
  @ApiCreatedResponse({
    description: '',
  })
  @HttpCode(HttpStatus.OK)
  async updateModelCost(@Param('id') id: string, @Body() data: UpdateModelCostDto) {
    const response = await this.fileService.updateModelCost({
      id: data.modelId,
      cost: data.cost,
      partiyaId: id,
    });

    return response;
  }

  @Get('/model/:id/:modelId')
  @ApiOperation({
    summary: 'dfasdfadgafgasdfasdfasd',
  })
  @ApiCreatedResponse({
    description: 'asdsfgasdfasdfasdf',
  })
  @HttpCode(HttpStatus.OK)
  async getModell(@Param('id') id: string, @Param('modelId') modelId: string) {
    // const response = await this.fileService.readProductsByModel(id, modelId) || [];

    return 'response';
  }

  @Public()
  @Post('/check/creata/product/subscribe/data')
  @ApiOperation({
    summary: 'dfasdfadgafgasdfasdfasd',
  })
  @ApiCreatedResponse({
    description: 'asdsfgasdfasdfasdf',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bar_code: { type: 'string', example: 'uuid' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async checkCreate(@Body() datas) {
    // const response = await this.fileService.readProductsByModel(id, modelId) || [];

    return await this.fileService.checkCreate(datas);
  }

  @Get('cashflows/excel')
  @ApiOperation({ summary: "CashFlow ma'lumotlarni Excel formatida export qilish" })
  @ApiQuery({ name: 'kassaId', required: false })
  @ApiQuery({ name: 'reportId', required: false })
  @ApiQuery({ name: 'kassaReportId', required: false })
  @ApiResponse({ status: 200 })
  async exportCashFlowsToExcel(
    @Res() res: Response,
    @Query('kassaId') kassaId?: string,
    @Query('reportId') reportId?: string,
    @Query('kassaReportId') kassaReportId?: string,
  ) {
    return await this.fileService.exportCashFlowsByKassaAndFilial(res, kassaId, reportId, kassaReportId);
  }

  @Get('product/excel/new')
  @ApiOperation({ summary: "Product ma'lumotlarni Excel formatida export qilish" })
  @ApiQuery({ name: 'filialId', required: false })
  @ApiResponse({ status: 200 })
  async exportProductsToExcel(@Res() res: Response, @Query('filialId') filialId?: string) {
    return await this.fileService.exportProductsByFilial(res, filialId);
  }
}

import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ReInventoryService } from '@modules/re-inventory/re-inventory.service';
import { ProcessInventoryDto, ReInventoryQueryDto } from '@modules/re-inventory/re-inventory.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('Re-Inventory')
@Controller('re-inventory')
export class ReInventoryController {
  constructor(
    private readonly reInventoryService: ReInventoryService,
  ) {
  }

  @Get('/get-by/filial-report/:id')
  @ApiOperation({ summary: 'Method: returns all Qr-Base by id' })
  @ApiOkResponse({
    description: 'The Qr-Bases was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: ReInventoryQueryDto, @Param('id') id: string) {
    return await this.reInventoryService.getAll(query, id, query.type, query.search);
  }

  @Get('/get-by/filial-report/totals/:id')
  @ApiOperation({ summary: 'Method: returns all Qr-Base by id' })
  @ApiOkResponse({
    description: 'The Qr-Bases was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAllTotals(@Query() query: ReInventoryQueryDto, @Param('id') id: string) {
    return await this.reInventoryService.getAllTotals(id, query.type, query.search);
  }

  @Post('process')
  @ApiOperation({ summary: 'Method: check product' })
  @ApiOkResponse({
    description: 'The product checked successfully',
  })
  @HttpCode(HttpStatus.OK)
  async process(@Body() dto: ProcessInventoryDto, @CurrentUser('id') userId: string) {
    return this.reInventoryService.processInventory(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update re_inventory check_count' })
  @HttpCode(HttpStatus.OK)
  async updateCheckCount(
    @Param('id') id: string,
    @Body() body: { check_count: number },
    @CurrentUser('id') userId: string,
  ) {
    return this.reInventoryService.updateCheckCount(id, Number(body.check_count), userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Reset check_count (matched row) or delete (ortiqcha row)' })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.reInventoryService.removeItem(id, userId);
  }

  @Post('/clone/:id')
  @ApiOperation({ summary: 'Method: clone products to re-inventory for report' })
  @ApiOkResponse({
    description: 'Products cloned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async cloneToReInventory(@Param('id') id: string) {
    return this.reInventoryService.cloneToReInventory(id);
  }
}
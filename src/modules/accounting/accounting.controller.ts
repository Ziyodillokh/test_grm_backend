import { Controller, Get, HttpCode, HttpException, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { RangeDto } from '../../infra/shared/dto';
import { OrderCashflowDto } from './dto';

@ApiTags('Accounting')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}
  @Get('/internet-shop/by-range')
  @ApiOperation({ summary: 'Method: returns kassa accounting for all filial' })
  @ApiOkResponse({
    description: 'Kassa accounting returned successfully!',
  })
  @HttpCode(HttpStatus.OK)
  async getInternetMagazineSumByRange(@Req() req, @Query() query: RangeDto) {
    try {
      return await this.accountingService.getInternetShopSum(req.where);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/remaining-products')
  @ApiOperation({ summary: 'Method: returns remaining products' })
  @ApiOkResponse({
    description: 'Remaining products returned successfully!',
  })
  @HttpCode(HttpStatus.OK)
  async getRemainingProducts(@Query() query) {
    try {
      return await this.accountingService.getRemainingProducts(query);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/remaining-products-collection')
  @ApiOperation({ summary: 'Method: returns remaining products by collection' })
  @ApiOkResponse({
    description: 'Remaining products returned successfully!',
  })
  @HttpCode(HttpStatus.OK)
  async getRemainingProductsByCollection(@Query() query) {
    try {
      return await this.accountingService.getRemainingProductsByCollection(query);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/remaining-sums')
  @ApiOperation({ summary: 'Method: returns remaining orders' })
  @ApiOkResponse({
    description: 'Remaining products returned successfully!',
  })
  @HttpCode(HttpStatus.OK)
  async getRemainingSums() {
    try {
      return await this.accountingService.getTotal();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/order-cashflow')
  @ApiOperation({ summary: 'Method: returns all kassa' })
  @ApiOkResponse({
    description: 'The kassa were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async kassaData(@Query() query: OrderCashflowDto) {
    return await this.accountingService.getKassaActions(query);
  }
}

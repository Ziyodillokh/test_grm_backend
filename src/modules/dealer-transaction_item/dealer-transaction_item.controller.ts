import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DealerTransactionItemService } from './dealer-transaction_item.service';
import { CreateDealerTransactionItemDto } from './dto/create-dealer-transaction_item.dto';
import { UpdateDealerTransactionItemDto } from './dto/update-dealer-transaction_item.dto';

@Controller('dealer-transaction-item')
export class DealerTransactionItemController {
  constructor(private readonly dealerTransactionItemService: DealerTransactionItemService) {}

  @Post()
  create(@Body() createDealerTransactionItemDto: CreateDealerTransactionItemDto) {
    return this.dealerTransactionItemService.create(createDealerTransactionItemDto);
  }

  @Get()
  findAll() {
    return this.dealerTransactionItemService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealerTransactionItemService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDealerTransactionItemDto: UpdateDealerTransactionItemDto) {
    return this.dealerTransactionItemService.update(+id, updateDealerTransactionItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealerTransactionItemService.remove(+id);
  }
}

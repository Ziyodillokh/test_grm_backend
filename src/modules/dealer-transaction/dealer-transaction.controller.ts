import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DealerTransactionService } from './dealer-transaction.service';
import { CreateDealerTransactionDto } from './dto/create-dealer-transaction.dto';
import { UpdateDealerTransactionDto } from './dto/update-dealer-transaction.dto';

@Controller('dealer-transaction')
export class DealerTransactionController {
  constructor(private readonly dealerTransactionService: DealerTransactionService) {}

  @Post()
  create(@Body() createDealerTransactionDto: CreateDealerTransactionDto) {
    return this.dealerTransactionService.create(createDealerTransactionDto);
  }

  @Get()
  findAll() {
    return this.dealerTransactionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealerTransactionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDealerTransactionDto: UpdateDealerTransactionDto) {
    return this.dealerTransactionService.update(+id, updateDealerTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealerTransactionService.remove(+id);
  }
}

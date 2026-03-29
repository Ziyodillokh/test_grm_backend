import { Injectable } from '@nestjs/common';
import { CreateDealerTransactionItemDto } from './dto/create-dealer-transaction_item.dto';
import { UpdateDealerTransactionItemDto } from './dto/update-dealer-transaction_item.dto';

@Injectable()
export class DealerTransactionItemService {
  create(createDealerTransactionItemDto: CreateDealerTransactionItemDto) {
    return 'This action adds a new dealerTransactionItem';
  }

  findAll() {
    return `This action returns all dealerTransactionItem`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dealerTransactionItem`;
  }

  update(id: number, updateDealerTransactionItemDto: UpdateDealerTransactionItemDto) {
    return `This action updates a #${id} dealerTransactionItem`;
  }

  remove(id: number) {
    return `This action removes a #${id} dealerTransactionItem`;
  }
}

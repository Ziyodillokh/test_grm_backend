import { Injectable } from '@nestjs/common';
import { CreateDealerTransactionDto } from './dto/create-dealer-transaction.dto';
import { UpdateDealerTransactionDto } from './dto/update-dealer-transaction.dto';

@Injectable()
export class DealerTransactionService {
  create(createDealerTransactionDto: CreateDealerTransactionDto) {
    return 'This action adds a new dealerTransaction';
  }

  findAll() {
    return `This action returns all dealerTransaction`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dealerTransaction`;
  }

  update(id: number, updateDealerTransactionDto: UpdateDealerTransactionDto) {
    return `This action updates a #${id} dealerTransaction`;
  }

  remove(id: number) {
    return `This action removes a #${id} dealerTransaction`;
  }
}

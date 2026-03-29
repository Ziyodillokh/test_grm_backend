import { PartialType } from '@nestjs/swagger';
import { CreateDealerTransactionItemDto } from './create-dealer-transaction_item.dto';

export class UpdateDealerTransactionItemDto extends PartialType(CreateDealerTransactionItemDto) {}

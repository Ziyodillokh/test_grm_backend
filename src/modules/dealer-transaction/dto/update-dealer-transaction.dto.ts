import { PartialType } from '@nestjs/swagger';
import { CreateDealerTransactionDto } from './create-dealer-transaction.dto';

export class UpdateDealerTransactionDto extends PartialType(CreateDealerTransactionDto) {}

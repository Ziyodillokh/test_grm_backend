import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import DebtTransactionTypeEnum from 'src/infra/shared/enum/debt-type-enum';

export class DebtTransactionDto {
  @ApiProperty({ description: 'Debt ID' })
  @IsUUID()
  @IsNotEmpty()
  debtId: string;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'Comment for the transaction' })
  @IsString()
  @IsOptional()
  comment: string;

  @ApiProperty({ description: 'Kassa ID' })
  @IsUUID()
  @IsNotEmpty()
  kassaId: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: DebtTransactionTypeEnum,
    example: DebtTransactionTypeEnum.TAKE,
  })
  @IsEnum(DebtTransactionTypeEnum)
  @IsNotEmpty()
  transactionType: DebtTransactionTypeEnum;
}

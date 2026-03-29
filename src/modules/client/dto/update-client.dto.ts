import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';
import { IsNumber, Min } from 'class-validator';

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class PayDebtDto {
  @ApiProperty({
    example: 100000,
    description: 'Mijoz tomonidan to‘langan qarz summasi',
  })
  @IsNumber()
  @Min(0)
  amount: number;
}

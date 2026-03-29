import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsDateString } from 'class-validator';

class CreateCurrencyDto {
  @ApiProperty({ example: '123.45', description: 'USD amount as string' })
  @IsNumberString()
  usd: string;

  @ApiProperty({ example: '156789.00', description: 'UZS amount as string' })
  @IsNumberString()
  uzs: string;

  @ApiProperty({ example: '2025-04-25T12:00:00Z', description: 'Date in ISO format' })
  @IsDateString()
  date: string;
}


export default CreateCurrencyDto
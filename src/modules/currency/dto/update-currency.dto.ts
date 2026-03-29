import { PartialType } from '@nestjs/swagger';
import CreateCurrencyDto from './create-currency.dto';

class UpdateCurrencyDto extends PartialType(CreateCurrencyDto) {}

export default UpdateCurrencyDto;
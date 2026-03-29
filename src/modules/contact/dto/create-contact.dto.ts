import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID, Matches } from 'class-validator';

class CreateContactDto {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  secondName: string;

  @ApiProperty()
  @IsNotEmpty()
  comment: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID('4')
  filial: string;

  @ApiProperty({ example: '+998901234567' })
  @Matches(/^\+998(9[0-9]|3[3]|7[1]|6[1-6])[0-9]{7}$/, {
    message: 'Phone number must be a valid Uzbekistan number starting with +998',
  })
  phone: string;
}

export default CreateContactDto;
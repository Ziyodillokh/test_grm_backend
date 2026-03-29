import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateClientOrderDto {
  @ApiProperty({
    description: `FirstName`,
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  readonly firstName: string;
}

export default CreateClientOrderDto;

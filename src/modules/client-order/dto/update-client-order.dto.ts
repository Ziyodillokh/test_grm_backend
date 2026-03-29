import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateClientOrderDto {
  @ApiProperty({
    description: `name`,
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  readonly firstName: string;
}

export default UpdateClientOrderDto;

import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateUserClientDto {
  @ApiProperty({
    description: `Firstname`,
    example: 'John',
  })
  @IsOptional()
  @IsString()
  readonly firstName: string;

  @ApiProperty({
    description: `Lastname`,
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  readonly lastName: string;

  @ApiProperty({
    description: `avatar`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID('4')
  readonly avatar: string;
}

export default UpdateUserClientDto;

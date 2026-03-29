import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleEnum } from '../../../infra/shared/enum';
class CreatePositionDto {
  @ApiProperty({
    description: `title`,
    example: 'Backend developer',
  })
  @IsNotEmpty()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `role`,
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly role: UserRoleEnum;
}

export default CreatePositionDto;

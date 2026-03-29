import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoleEnum } from '../../../infra/shared/enum';

class UpdatePositionDto {
  @ApiProperty({
    description: `title`,
    example: 'Graphic design',
  })
  @IsOptional()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `role`,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  readonly role: UserRoleEnum;
}
export default UpdatePositionDto;

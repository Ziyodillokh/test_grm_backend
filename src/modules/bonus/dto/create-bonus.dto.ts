import { IsString, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import ConditionUnit from 'src/infra/shared/enum/forbonus/condition-type';
import OperatorType from 'src/infra/shared/enum/forbonus/operator-type';
import BonusType from 'src/infra/shared/enum/forbonus/bonus-type';

export class CreateBonusDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  condition: number;

  @ApiProperty({
    example: 'шт',
    enum: ConditionUnit,
  })
  @IsEnum(ConditionUnit)
  conditionUnit: ConditionUnit;

  @ApiProperty({
    example: '>',
    enum: OperatorType,
  })
  @IsEnum(OperatorType)
  operator: OperatorType;

  @ApiProperty({ example: 100 })
  @IsNumber()
  bonusAmount: number;

  @ApiProperty({
    example: '$',
    enum: BonusType,
    description: 'Bonus type (e.g., %, $)',
  })
  @IsEnum(BonusType)
  bonusUnit: BonusType;

  @ApiProperty({
    example: '2025-05-16',
    description: 'Bonus end date (YYYY-MM-DD)',
  })
  @IsDateString()
  endDate: string;
}

import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
class CreatePlanYearDto {
  @ApiProperty({
    description: `planka`,
    example: '12000000',
  })
  @IsNotEmpty()
  @IsNumber()
  readonly yearlyGoal: number;
}

export default CreatePlanYearDto;

export class UpdateFilialPlanDto {
  filialId: string;
  yearlyGoal: number;
}

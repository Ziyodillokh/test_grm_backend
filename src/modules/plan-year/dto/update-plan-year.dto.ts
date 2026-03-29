import { PartialType } from '@nestjs/swagger';
import CreatePlanYearDto from './create-plan-year.dto';
import { IsNumber, Min } from 'class-validator';

export class UpdatePlanYearDto extends PartialType(CreatePlanYearDto) {}

export type CollectedAmountSummary = {
  filialId: string;
  filialName: string;
  collectedAmount: number;
};

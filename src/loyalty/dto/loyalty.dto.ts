import { IsNumber, IsOptional, IsString } from "class-validator";

export class RedeemPointsDto {
  @IsNumber()
  points!: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class CreateTierRuleDto {
  @IsString()
  tier!: string;

  @IsNumber()
  minPoints!: number;

  @IsOptional()
  @IsNumber()
  pointsMultiplier?: number;
}

export class UpdateTierRuleDto {
  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsNumber()
  minPoints?: number;

  @IsOptional()
  @IsNumber()
  pointsMultiplier?: number;
}

export class AdjustPointsDto {
  @IsNumber()
  amount!: number;

  @IsString()
  description!: string;
}

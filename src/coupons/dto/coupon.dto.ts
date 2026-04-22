import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { COUPON_TYPES, type CouponType } from "../../database/schema/coupons";

const MAX_CODE_LENGTH = 50;
const MIN_CODE_LENGTH = 2;

export class CreateCouponDto {
  @IsString()
  @Length(MIN_CODE_LENGTH, MAX_CODE_LENGTH)
  code!: string;

  @IsIn(COUPON_TYPES as readonly string[])
  type!: CouponType;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @Length(MIN_CODE_LENGTH, MAX_CODE_LENGTH)
  code?: string;

  @IsOptional()
  @IsIn(COUPON_TYPES as readonly string[])
  type?: CouponType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  subtotal!: number;
}

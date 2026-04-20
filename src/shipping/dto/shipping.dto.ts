import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateShippingMethodDto {
  @IsString()
  name!: string;

  @IsString()
  carrier!: string;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsNumber()
  flatRate?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMin?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMax?: number;

  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShippingMethodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsNumber()
  flatRate?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMin?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMax?: number;

  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CalculateShippingDto {
  @IsString()
  cepDestino!: string;

  @IsString()
  productId!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  subtotal?: number;
}

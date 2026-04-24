import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

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

export class ShippingLineItemDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CalculateShippingDto {
  @IsOptional()
  @IsString()
  cepDestino?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingLineItemDto)
  items?: ShippingLineItemDto[];
}

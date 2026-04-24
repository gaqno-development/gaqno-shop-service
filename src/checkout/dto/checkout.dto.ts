import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AddressDto } from "../../order/dto/order.dto";

export class CheckoutDecorationDto {
  @IsUUID()
  decorationId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CheckoutLineDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variationId?: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutDecorationDto)
  decorations?: CheckoutDecorationDto[];

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  referenceImageUrl?: string;
}

export class CheckoutRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items!: CheckoutLineDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress!: AddressDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @IsOptional()
  @IsString()
  customerNotes?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsUUID()
  shippingMethodId!: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  deliveryTime?: string;

  @IsOptional()
  @IsBoolean()
  deliveryIsPickup?: boolean;
}

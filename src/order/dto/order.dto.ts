import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";

const MAX_PAGE_SIZE = 200;

const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const toInt = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

class OrderItemDecorationInputDto {
  @IsUUID()
  decorationId: string;

  @IsOptional()
  @IsString()
  customText?: string | null;
}

class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variationId?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  referenceImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDecorationInputDto)
  decorations?: OrderItemDecorationInputDto[];
}

class AddressDto {
  @IsString()
  name: string;

  @IsString()
  cep: string;

  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  neighborhood: string;

  @IsString()
  city: string;

  @IsString()
  state: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

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

export class UpdateOrderStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class OrderQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(toInt)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsNumber()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Transform(toInt)
  @IsNumber()
  @Min(0)
  offset?: number;
}

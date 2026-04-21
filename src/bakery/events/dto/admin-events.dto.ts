import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

const EVENT_TYPES = [
  "stock_purchase",
  "production",
  "delivery",
  "custom",
] as const;

export type AdminEventType = (typeof EVENT_TYPES)[number];

export class CreateAdminEventDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EVENT_TYPES)
  type: AdminEventType;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}

export class UpdateAdminEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EVENT_TYPES)
  type?: AdminEventType;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

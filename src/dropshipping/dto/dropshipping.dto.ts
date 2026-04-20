import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  SUPPLIER_SORT_OPTIONS,
  type DropshippingImportRequest,
  type DropshippingSearchRequest,
  type SupplierSortOption,
} from "@gaqno-development/types";

export class DropshippingSearchQueryDto
  implements Omit<DropshippingSearchRequest, "providerCode">
{
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPriceUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPriceUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrders?: number;

  @IsOptional()
  @IsString()
  shipToCountry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsIn(SUPPLIER_SORT_OPTIONS as readonly string[])
  sortBy?: SupplierSortOption;
}

export class ImportProductDto implements DropshippingImportRequest {
  @IsString()
  providerCode!: string;

  @IsString()
  externalId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  overrideMarginPercent?: number;

  @IsOptional()
  @IsBoolean()
  makeActive?: boolean;
}

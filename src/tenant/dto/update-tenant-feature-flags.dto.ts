import { IsBoolean, IsOptional } from "class-validator";

export class UpdateTenantFeatureFlagsDto {
  @IsOptional()
  @IsBoolean()
  featureShipping?: boolean;

  @IsOptional()
  @IsBoolean()
  featureDecorations?: boolean;

  @IsOptional()
  @IsBoolean()
  featureCoupons?: boolean;

  @IsOptional()
  @IsBoolean()
  featureRecipes?: boolean;

  @IsOptional()
  @IsBoolean()
  featureInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  featureCheckoutPro?: boolean;

  @IsOptional()
  @IsBoolean()
  featurePix?: boolean;

  @IsOptional()
  @IsBoolean()
  featureDropshipping?: boolean;

  @IsOptional()
  @IsBoolean()
  featureBakery?: boolean;
}

export const TENANT_FEATURE_FLAG_KEYS: readonly (keyof UpdateTenantFeatureFlagsDto)[] = [
  "featureShipping",
  "featureDecorations",
  "featureCoupons",
  "featureRecipes",
  "featureInventory",
  "featureCheckoutPro",
  "featurePix",
  "featureDropshipping",
  "featureBakery",
] as const;

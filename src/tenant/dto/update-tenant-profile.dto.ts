import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class UpdateTenantProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_RE, {
    message:
      "slug must contain only lowercase letters, digits and hyphens (no leading/trailing hyphen)",
  })
  @MaxLength(50)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  bgColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  faviconUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDropshipping?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(["bakery", "fashion", "generic"])
  vertical?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  layoutHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  terminologyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  orderPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandAppName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandFontFamily?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adminDomain?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicShopUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  analyticsMeasurementId?: string | null;

  @IsOptional()
  @IsBoolean()
  analyticsEnabled?: boolean;

  @IsOptional()
  @IsObject()
  storefrontCopy?: Record<string, unknown>;
}

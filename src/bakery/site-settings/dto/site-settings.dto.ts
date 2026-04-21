import { IsOptional, IsString, IsUrl } from "class-validator";

export class UpsertSiteSettingsDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  paymentDescriptor?: string;

  @IsOptional()
  @IsString()
  heroTitle?: string;

  @IsOptional()
  @IsString()
  heroSubtitle?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  introTitle?: string;

  @IsOptional()
  @IsString()
  introText?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;
}

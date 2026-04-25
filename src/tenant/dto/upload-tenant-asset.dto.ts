import { IsIn, IsOptional, IsString } from "class-validator";

export const TENANT_ASSET_TYPES = ["logo", "favicon", "hero"] as const;

export type TenantAssetType = (typeof TENANT_ASSET_TYPES)[number];

export class UploadTenantAssetDto {
  @IsOptional()
  @IsString()
  @IsIn(TENANT_ASSET_TYPES)
  type?: TenantAssetType;
}


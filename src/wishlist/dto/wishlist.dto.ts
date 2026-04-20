import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class AddWishlistItemDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsString()
  wishlistId?: string;
}

export class CreateWishlistDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateWishlistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

import {
  IsBoolean,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

const DECORATION_TYPES = [
  "topping",
  "filling",
  "message",
  "theme",
  "extra",
] as const;

export type DecorationType = (typeof DECORATION_TYPES)[number];

export class CreateDecorationDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsEnum(DECORATION_TYPES)
  type: DecorationType;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDecorationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsEnum(DECORATION_TYPES)
  type?: DecorationType;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

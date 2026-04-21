import {
  IsString,
  IsOptional,
  IsNumberString,
  MinLength,
} from "class-validator";

export class CreateIngredientDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  unit: string;

  @IsOptional()
  @IsNumberString()
  gramsPerUnit?: string;

  @IsOptional()
  @IsNumberString()
  stock?: string;

  @IsOptional()
  @IsNumberString()
  minStock?: string;

  @IsOptional()
  @IsNumberString()
  costPerUnit?: string;
}

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumberString()
  gramsPerUnit?: string;

  @IsOptional()
  @IsNumberString()
  stock?: string;

  @IsOptional()
  @IsNumberString()
  minStock?: string;

  @IsOptional()
  @IsNumberString()
  costPerUnit?: string;
}

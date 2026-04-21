import {
  ArrayNotEmpty,
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class RecipeIngredientInputDto {
  @IsUUID()
  ingredientId: string;

  @IsNumberString()
  quantity: string;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  yieldQuantity?: string;

  @IsOptional()
  @IsString()
  yieldUnit?: string;

  @IsOptional()
  @IsNumberString()
  laborCost?: string;

  @IsOptional()
  @IsNumberString()
  overheadCost?: string;

  @IsOptional()
  @IsNumberString()
  profitMarginPercent?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients?: RecipeIngredientInputDto[];
}

export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  yieldQuantity?: string;

  @IsOptional()
  @IsString()
  yieldUnit?: string;

  @IsOptional()
  @IsNumberString()
  laborCost?: string;

  @IsOptional()
  @IsNumberString()
  overheadCost?: string;

  @IsOptional()
  @IsNumberString()
  profitMarginPercent?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients?: RecipeIngredientInputDto[];
}

export class ReplaceRecipeIngredientsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients: RecipeIngredientInputDto[];
}

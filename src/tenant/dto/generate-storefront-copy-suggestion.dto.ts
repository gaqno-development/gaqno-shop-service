import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class GenerateStorefrontCopySuggestionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  maxProducts?: number;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  additionalContext?: string;
}

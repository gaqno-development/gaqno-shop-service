import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CheckTenantDnsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  hostname?: string;
}

import { IsString, IsEmail, IsOptional, IsDate, IsNumber, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

const MAX_PAGE_SIZE = 200;

const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const toInt = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export class CreateCustomerDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  birthDate?: Date;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CustomerQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toInt)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsNumber()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}

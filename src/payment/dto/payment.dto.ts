import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type, Transform } from "class-transformer";

export enum PaymentMethod {
  CREDIT_CARD = "credit_card",
  DEBIT_CARD = "debit_card",
  PIX = "pix",
  BOLETO = "boleto",
  WALLET = "wallet",
}

export class CreatePaymentDto {
  @IsString()
  orderNumber: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  cardToken?: string;

  @IsOptional()
  @IsString()
  issuerId?: string;

  @IsOptional()
  @IsNumber()
  installments?: number;

  @IsOptional()
  @IsString()
  payerEmail?: string;

  @IsOptional()
  @IsString()
  payerIdentificationType?: string;

  @IsOptional()
  @IsString()
  payerIdentificationNumber?: string;
}

class PaymentWebhookDataDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  transactionAmount?: number;

  @IsOptional()
  @IsNumber()
  transaction_amount?: number;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  external_reference?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}

export class PaymentWebhookDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  id?: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  dataId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentWebhookDataDto)
  data?: PaymentWebhookDataDto;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  transactionAmount?: number;

  @IsOptional()
  @IsNumber()
  transaction_amount?: number;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  external_reference?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

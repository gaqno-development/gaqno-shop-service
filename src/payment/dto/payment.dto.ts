import { IsString, IsNumber, IsOptional, IsEnum, Min } from "class-validator";

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

export class PaymentWebhookDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsString()
  dataId: string;
}

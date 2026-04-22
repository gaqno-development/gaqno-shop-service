import { IsEnum, IsNotEmpty, IsString, IsUUID } from "class-validator";

const PROVIDERS = ["mercado_pago", "stripe", "pagseguro"] as const;

export class BootstrapPaymentGatewayDto {
  @IsUUID()
  @IsNotEmpty()
  tenantId!: string;

  @IsString()
  @IsEnum(PROVIDERS)
  provider!: (typeof PROVIDERS)[number];
}

export class UpsertCredentialsDto {
  @IsUUID()
  @IsNotEmpty()
  tenantId!: string;

  @IsString()
  @IsEnum(PROVIDERS)
  provider!: (typeof PROVIDERS)[number];

  credentials!: Record<string, unknown>;
}

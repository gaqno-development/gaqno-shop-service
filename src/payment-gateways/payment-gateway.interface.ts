export type PaymentProvider = "mercado_pago" | "stripe" | "pagseguro";

export type NormalizedPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export interface GatewayCredentials {
  readonly access_token?: string;
  readonly public_key?: string;
  readonly webhook_secret?: string;
  readonly [key: string]: unknown;
}

export interface CheckoutItem {
  readonly title: string;
  readonly description?: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly categoryId?: string;
}

export interface CheckoutInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly payerEmail: string;
  readonly description: string;
  readonly returnUrl: string;
  readonly notificationUrl: string;
  readonly items?: readonly CheckoutItem[];
  readonly statementDescriptor?: string;
  readonly installments?: number;
  readonly credentials: GatewayCredentials;
  readonly metadata?: Record<string, unknown>;
}

export interface CheckoutResult {
  readonly provider: PaymentProvider;
  readonly paymentId: string;
  readonly checkoutUrl: string;
  readonly status: NormalizedPaymentStatus;
}

export interface PixInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amountCents: number;
  readonly payerEmail: string;
  readonly description: string;
  readonly expiresInMinutes: number;
  readonly credentials: GatewayCredentials;
}

export interface PixResult {
  readonly provider: PaymentProvider;
  readonly paymentId: string;
  readonly qrCode: string;
  readonly qrCodeBase64: string;
  readonly expiresAt: Date;
  readonly status: NormalizedPaymentStatus;
}

export interface PaymentStatusInfo {
  readonly provider: PaymentProvider;
  readonly paymentId: string;
  readonly status: NormalizedPaymentStatus;
  readonly statusDetail: string | null;
  readonly externalReference: string | null;
  readonly amountCents: number | null;
}

export interface RefundInput {
  readonly providerPaymentId: string;
  readonly amountCents?: number;
  readonly credentials: GatewayCredentials;
}

export interface RefundResult {
  readonly provider: PaymentProvider;
  readonly providerPaymentId: string;
  readonly refundId: string;
  readonly status: string;
  readonly amountCents?: number;
}

export interface WebhookVerifyInput {
  readonly rawBody: string;
  readonly headers: Record<string, string | undefined>;
  readonly credentials: GatewayCredentials;
}

export interface WebhookEvent {
  readonly provider: PaymentProvider;
  readonly eventType: string;
  readonly paymentId?: string;
  readonly resourceUrl?: string;
  readonly raw: unknown;
}

export interface ValidateCredentialsInput {
  readonly credentials: GatewayCredentials;
}

export interface ValidateCredentialsResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export interface IPaymentGateway {
  readonly provider: PaymentProvider;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  createPixPayment(input: PixInput): Promise<PixResult>;
  getPaymentStatus(
    paymentId: string,
    credentials: GatewayCredentials,
  ): Promise<PaymentStatusInfo>;
  searchPaymentsByReference(
    externalReference: string,
    credentials: GatewayCredentials,
  ): Promise<PaymentStatusInfo | null>;
  verifyWebhookSignature(input: WebhookVerifyInput): boolean;
  parseWebhook(payload: unknown): WebhookEvent;
  refund(input: RefundInput): Promise<RefundResult>;
  validateCredentials(
    input: ValidateCredentialsInput,
  ): Promise<ValidateCredentialsResult>;
}

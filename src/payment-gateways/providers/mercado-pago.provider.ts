import { Injectable } from "@nestjs/common";
import * as crypto from "node:crypto";
import {
  MercadoPagoConfig,
  Payment,
  PaymentRefund,
  Preference,
  User,
} from "mercadopago";
import {
  CheckoutInput,
  CheckoutItem,
  CheckoutResult,
  GatewayCredentials,
  IPaymentGateway,
  NormalizedPaymentStatus,
  PaymentStatusInfo,
  PixInput,
  PixResult,
  RefundInput,
  RefundResult,
  ValidateCredentialsInput,
  ValidateCredentialsResult,
  WebhookEvent,
  WebhookVerifyInput,
} from "../payment-gateway.interface";

const NORMALIZED_STATUSES: readonly NormalizedPaymentStatus[] = [
  "pending",
  "approved",
  "authorized",
  "in_process",
  "in_mediation",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
];

interface MpClients {
  readonly payment: {
    create: (args: {
      body: Record<string, unknown>;
      requestOptions?: { idempotencyKey?: string };
    }) => Promise<unknown>;
    get: (args: { id: number | string }) => Promise<unknown>;
    search: (args: { options: Record<string, unknown> }) => Promise<unknown>;
  };
  readonly preference: {
    create: (args: {
      body: Record<string, unknown>;
      requestOptions?: { idempotencyKey?: string };
    }) => Promise<unknown>;
  };
  readonly user: {
    get: () => Promise<unknown>;
  };
  readonly refund: {
    create: (args: {
      payment_id: string | number;
      body?: { amount?: number };
      requestOptions?: { idempotencyKey?: string };
    }) => Promise<unknown>;
  };
}

function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

function normalizeStatus(raw: unknown): NormalizedPaymentStatus {
  if (typeof raw !== "string") return "pending";
  return (NORMALIZED_STATUSES as readonly string[]).includes(raw)
    ? (raw as NormalizedPaymentStatus)
    : "pending";
}

function isPublicHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const { hostname } = parsed;
    if (hostname === "localhost" || hostname === "127.0.0.1") return false;
    if (hostname.startsWith("192.168.")) return false;
    return true;
  } catch {
    return false;
  }
}

function buildPreferenceItems(
  input: CheckoutInput,
): Array<Record<string, unknown>> {
  const list = input.items && input.items.length > 0
    ? input.items
    : [singleItemFromInput(input)];
  return list.map((item, index) => ({
    id: `${input.orderNumber}-${index}`,
    title: item.title,
    description: item.description ?? item.title,
    quantity: item.quantity,
    unit_price: centsToReais(item.unitPriceCents),
    currency_id: input.currency,
    category_id: item.categoryId ?? "others",
  }));
}

function singleItemFromInput(input: CheckoutInput): CheckoutItem {
  return {
    title: input.description,
    description: input.description,
    quantity: 1,
    unitPriceCents: input.amountCents,
  };
}

const MERCADO_PAGO_CHECKOUT_PRO_EXCLUDED_PAYMENT_TYPE_IDS: readonly { id: string }[] = [
  { id: "account_money" },
  { id: "atm" },
  { id: "debit_card" },
  { id: "prepaid_card" },
  { id: "digital_currency" },
  { id: "voucher" },
];

interface MpPaymentResponse {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
}

@Injectable()
export class MercadoPagoProvider implements IPaymentGateway {
  readonly provider = "mercado_pago" as const;

  private assertAccessToken(credentials: GatewayCredentials): void {
    if (!credentials.access_token) {
      throw new Error("Mercado Pago credentials missing access_token");
    }
  }

  protected buildClients(credentials: GatewayCredentials): MpClients {
    const accessToken = credentials.access_token;
    if (!accessToken) {
      throw new Error("Mercado Pago credentials missing access_token");
    }
    const config = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10_000 },
    });
    const payment = new Payment(config);
    const preference = new Preference(config);
    const user = new User(config);
    const refund = new PaymentRefund(config);
    return {
      payment: {
        create: (args) =>
          payment.create(
            args as unknown as Parameters<typeof payment.create>[0],
          ),
        get: (args) => payment.get(args),
        search: (args) =>
          payment.search(
            args as unknown as Parameters<typeof payment.search>[0],
          ),
      },
      preference: {
        create: (args) =>
          preference.create(
            args as unknown as Parameters<typeof preference.create>[0],
          ),
      },
      user: {
        get: () => user.get(),
      },
      refund: {
        create: (args) =>
          refund.create(
            args as unknown as Parameters<typeof refund.create>[0],
          ),
      },
    };
  }

  async createPixPayment(input: PixInput): Promise<PixResult> {
    this.assertAccessToken(input.credentials);
    const clients = this.buildClients(input.credentials);
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);

    const response = (await clients.payment.create({
      body: {
        transaction_amount: centsToReais(input.amountCents),
        payment_method_id: "pix",
        payer: { email: input.payerEmail },
        description: input.description,
        external_reference: input.orderNumber,
        date_of_expiration: expiresAt.toISOString(),
      },
      requestOptions: {
        idempotencyKey: `pix-${input.orderNumber}`,
      },
    })) as MpPaymentResponse;

    const txData = response.point_of_interaction?.transaction_data;
    if (!response.id || !txData?.qr_code || !txData?.qr_code_base64) {
      throw new Error("Invalid MP PIX response: missing QR code data");
    }

    return {
      provider: this.provider,
      paymentId: String(response.id),
      qrCode: txData.qr_code,
      qrCodeBase64: txData.qr_code_base64,
      expiresAt: response.date_of_expiration
        ? new Date(response.date_of_expiration)
        : expiresAt,
      status: normalizeStatus(response.status),
    };
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    this.assertAccessToken(input.credentials);
    const clients = this.buildClients(input.credentials);
    const isPublic =
      isPublicHttpsUrl(input.returnUrl) &&
      isPublicHttpsUrl(input.notificationUrl);

    const body: Record<string, unknown> = {
      items: buildPreferenceItems(input),
      payer: { email: input.payerEmail },
      external_reference: input.orderNumber,
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [...MERCADO_PAGO_CHECKOUT_PRO_EXCLUDED_PAYMENT_TYPE_IDS],
        installments: input.installments ?? 12,
      },
      statement_descriptor: (input.statementDescriptor ?? "GAQNO").slice(0, 22),
      binary_mode: false,
      metadata: input.metadata ?? {},
    };

    if (isPublic) {
      body.back_urls = {
        success: `${input.returnUrl}?status=approved`,
        failure: `${input.returnUrl}?status=rejected`,
        pending: `${input.returnUrl}?status=pending`,
      };
      body.auto_return = "approved";
      body.notification_url = input.notificationUrl;
    }

    const response = (await clients.preference.create({
      body,
      requestOptions: { idempotencyKey: `pref-${input.orderNumber}` },
    })) as { id: string; init_point: string };

    if (!response.id || !response.init_point) {
      throw new Error("Invalid MP preference response");
    }

    return {
      provider: this.provider,
      paymentId: response.id,
      checkoutUrl: response.init_point,
      status: "pending",
    };
  }

  async getPaymentStatus(
    paymentId: string,
    credentials: GatewayCredentials,
  ): Promise<PaymentStatusInfo> {
    this.assertAccessToken(credentials);
    const clients = this.buildClients(credentials);
    const response = (await clients.payment.get({
      id: Number.isNaN(Number(paymentId)) ? paymentId : Number(paymentId),
    })) as MpPaymentResponse;
    return this.toStatusInfo(response);
  }

  async searchPaymentsByReference(
    externalReference: string,
    credentials: GatewayCredentials,
  ): Promise<PaymentStatusInfo | null> {
    this.assertAccessToken(credentials);
    const clients = this.buildClients(credentials);
    const response = (await clients.payment.search({
      options: {
        criteria: "desc",
        sort: "date_created",
        external_reference: externalReference,
      },
    })) as { results?: MpPaymentResponse[] };

    const results = response.results ?? [];
    if (results.length === 0) return null;
    const approved = results.find((r) => r.status === "approved");
    const target = approved ?? results[0];
    if (!target?.id) return null;
    return this.toStatusInfo(target);
  }

  verifyWebhookSignature(input: WebhookVerifyInput): boolean {
    const secret = input.credentials.webhook_secret;
    if (!secret) return false;

    const xSignature = input.headers["x-signature"];
    const xRequestId = input.headers["x-request-id"];
    if (!xSignature || !xRequestId) return false;

    const parts = Object.fromEntries(
      xSignature.split(",").map((p) => {
        const [k, ...v] = p.trim().split("=");
        return [k, v.join("=")];
      }),
    ) as Record<string, string | undefined>;

    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    let dataId = "";
    try {
      const parsed = JSON.parse(input.rawBody) as {
        data?: { id?: string | number };
      };
      dataId = String(parsed.data?.id ?? "");
    } catch {
      return false;
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(hmac, "hex"),
        Buffer.from(v1, "hex"),
      );
    } catch {
      return false;
    }
  }

  parseWebhook(payload: unknown): WebhookEvent {
    const envelope = payload as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
      resource?: string;
    };
    const paymentId = envelope.data?.id;
    return {
      provider: this.provider,
      eventType: envelope.action ?? envelope.type ?? "unknown",
      paymentId: paymentId ? String(paymentId) : undefined,
      resourceUrl: envelope.resource,
      raw: payload,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.assertAccessToken(input.credentials);
    const clients = this.buildClients(input.credentials);
    const body: Record<string, unknown> = {};
    if (input.amountCents != null && input.amountCents > 0) {
      body.amount = centsToReais(input.amountCents);
    }
    const response = (await clients.refund.create({
      payment_id: input.providerPaymentId,
      body: Object.keys(body).length > 0 ? body : undefined,
      requestOptions: {
        idempotencyKey: `refund-${input.providerPaymentId}-${input.amountCents ?? "full"}`,
      },
    })) as {
      id: number | string;
      status?: string;
      amount?: number;
    };

    return {
      provider: this.provider,
      providerPaymentId: input.providerPaymentId,
      refundId: String(response.id),
      status: response.status ?? "refunded",
      amountCents:
        typeof response.amount === "number"
          ? Math.round(response.amount * 100)
          : input.amountCents,
    };
  }

  async validateCredentials(
    input: ValidateCredentialsInput,
  ): Promise<ValidateCredentialsResult> {
    const accessToken = input.credentials.access_token;
    if (!accessToken) {
      return { valid: false, reason: "access_token is required" };
    }
    try {
      const clients = this.buildClients(input.credentials);
      await clients.user.get();
      return { valid: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Invalid credentials";
      return { valid: false, reason };
    }
  }

  private toStatusInfo(response: MpPaymentResponse): PaymentStatusInfo {
    return {
      provider: this.provider,
      paymentId: String(response.id),
      status: normalizeStatus(response.status),
      statusDetail: response.status_detail ?? null,
      externalReference: response.external_reference ?? null,
      amountCents:
        typeof response.transaction_amount === "number"
          ? Math.round(response.transaction_amount * 100)
          : null,
    };
  }
}

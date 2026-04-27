import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { orders, tenantPaymentGateways, tenants } from "../database/schema";
import type { Order } from "../database/schema";
import { and, eq, or } from "drizzle-orm";
import { CreatePaymentDto, PaymentMethod } from "./dto/payment.dto";
import { PaymentGatewaysService } from "../payment-gateways/payment-gateways.service";
import { PaymentGatewayFactory } from "../payment-gateways/payment-gateway.factory";
import type {
  GatewayCredentials,
  CheckoutItem,
  NormalizedPaymentStatus,
  PaymentStatusInfo,
} from "../payment-gateways/payment-gateway.interface";
import { OrderMailService } from "../mail/order-mail.service";
import type { ShopDatabase } from "../database/shop-database.type";

const PAID_WEBHOOK_STATUSES = new Set(["approved", "authorized"]);
const IN_FLIGHT_PAYMENT_STATUSES = new Set([
  "pending",
  "in_process",
  "authorized",
  "approved",
]);

type WebhookBody = {
  action?: string;
  data?: { id?: string | number };
  type?: string;
  topic?: string;
  resource?: string;
};

function parseWebhookBody(rawBody: string): WebhookBody {
  try {
    return JSON.parse(rawBody) as WebhookBody;
  } catch {
    return {};
  }
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (Array.isArray(v)) {
      out[key] = v[0];
    } else {
      out[key] = v;
    }
  }
  return out;
}

function isMerchantOrderTopic(body: WebhookBody, requestUrl: string): boolean {
  if (body.topic === "merchant_order") return true;
  if (body.action?.includes("merchant_order")) return true;
  try {
    const u = new URL(requestUrl, "http://localhost");
    return u.searchParams.get("topic") === "merchant_order";
  } catch {
    return false;
  }
}

function extractPaymentIdFromResource(
  body: WebhookBody,
  requestUrl: string,
): string | null {
  try {
    const u = new URL(requestUrl, "http://localhost");
    const topic = body.topic ?? u.searchParams.get("topic");
    if (topic !== "payment") return null;
    if (body.data?.id !== undefined && body.data?.id !== null) {
      return String(body.data.id);
    }
    const resource = body.resource ?? u.searchParams.get("resource") ?? "";
    const match = resource.match(/\/payments\/(\d+)/);
    return match?.[1] ?? u.searchParams.get("id");
  } catch {
    return null;
  }
}

function extractPaymentId(
  body: WebhookBody,
  requestUrl: string,
): string | null {
  if (body.data?.id !== undefined && body.data?.id !== null) {
    return String(body.data.id);
  }
  return extractPaymentIdFromResource(body, requestUrl);
}

function orderTotalCents(total: string | number): number {
  return Math.round(Number.parseFloat(String(total)) * 100);
}

function readPublicShopUrl(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const v = (settings as { publicShopUrl?: unknown }).publicShopUrl;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function mapNormalizedToDbStatus(
  s: NormalizedPaymentStatus,
):
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back" {
  const allowed: ReadonlySet<string> = new Set([
    "pending",
    "approved",
    "authorized",
    "in_process",
    "in_mediation",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ]);
  return allowed.has(s) ? (s as never) : "pending";
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly configService: ConfigService,
    private readonly paymentGatewaysService: PaymentGatewaysService,
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
    private readonly orderMailService: OrderMailService,
  ) {}

  async createPayment(tenantId: string, dto: CreatePaymentDto) {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, dto.orderNumber)),
      with: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (
      order.paymentExternalId &&
      IN_FLIGHT_PAYMENT_STATUSES.has(String(order.paymentStatus))
    ) {
      return {
        orderNumber: order.orderNumber,
        paymentExternalId: order.paymentExternalId,
        paymentStatus: order.paymentStatus,
        paymentUrl: order.paymentExternalUrl,
        qrCode: order.pixQrCode,
        qrCodeBase64: order.pixQrCodeBase64,
      };
    }

    if (order.paymentStatus === "approved") {
      throw new ConflictException("Order payment is already approved");
    }

    const gateway = await this.paymentGatewaysService.getPreferredGatewayForTenant(
      tenantId,
      "mercado_pago",
    );
    const accessToken = gateway?.credentials?.access_token;
    if (!accessToken || typeof accessToken !== "string") {
      throw new BadRequestException("Payment not configured for this tenant");
    }

    const enabledMethods = await this.getEnabledPaymentMethods(tenantId);
    if (enabledMethods.length === 0) {
      throw new BadRequestException("No payment methods are enabled for this store");
    }
    const requested = String(dto.paymentMethod);
    if (!enabledMethods.includes(requested)) {
      throw new BadRequestException("This payment method is not available for this store");
    }

    const credentials = gateway.credentials as GatewayCredentials;
    const mp = this.paymentGatewayFactory.get("mercado_pago");

    if (dto.paymentMethod === PaymentMethod.PIX) {
      return this.createPixPaymentReal(order, dto, credentials, gateway?.id, mp);
    }

    return this.createCheckoutProPayment(
      tenantId,
      order,
      dto,
      credentials,
      gateway?.id,
      mp,
    );
  }

  private resolvePayerEmail(order: Order & { customer?: { email?: string } | null }, dto: CreatePaymentDto): string {
    const fromDto = dto.payerEmail?.trim();
    if (fromDto) return fromDto;
    const fromCustomer = order.customer?.email?.trim();
    if (fromCustomer) return fromCustomer;
    throw new BadRequestException("payerEmail is required for Mercado Pago");
  }

  private async resolvePaymentPublicUrlsAsync(
    tenantId: string,
    orderNumber: string,
  ): Promise<{ returnUrl: string; notificationUrl: string }> {
    const publicBase = this.configService
      .get<string>("SHOP_SERVICE_PUBLIC_BASE_URL")
      ?.replace(/\/+$/, "");
    if (!publicBase) {
      return { returnUrl: "http://localhost", notificationUrl: "http://localhost" };
    }
    const notificationUrl = `${publicBase}/v1/payments/webhook`;
    const tenantRow = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    const shopUrl = readPublicShopUrl(tenantRow?.settings);
    const slug = tenantRow?.slug?.trim() ?? "";
    const storefrontEnv = this.configService
      .get<string>("SHOP_STOREFRONT_PUBLIC_URL")
      ?.replace(/\/+$/, "");
    const storefrontBase =
      shopUrl && shopUrl.startsWith("https://")
        ? shopUrl.replace(/\/+$/, "")
        : storefrontEnv && /^https?:\/\//i.test(storefrontEnv)
          ? storefrontEnv
          : "";
    const tenantQs = slug ? `&tenant=${encodeURIComponent(slug)}` : "";
    const returnPath = `/pagamento/retorno?order=${encodeURIComponent(orderNumber)}${tenantQs}`;
    const returnUrl = storefrontBase
      ? `${storefrontBase.replace(/\/+$/, "")}${returnPath}`
      : `${publicBase}/v1/payments/return?order=${encodeURIComponent(orderNumber)}${tenantQs}`;
    return { returnUrl, notificationUrl };
  }

  private async createPixPaymentReal(
    order: Order & { customer?: { email?: string } | null },
    dto: CreatePaymentDto,
    credentials: GatewayCredentials,
    paymentGatewayId: string | undefined,
    mp: ReturnType<PaymentGatewayFactory["get"]>,
  ) {
    const payerEmail = this.resolvePayerEmail(order, dto);
    const amountCents = orderTotalCents(order.total);
    const pixMinutes = Number(
      this.configService.get<string>("MERCADO_PAGO_PIX_EXPIRY_MINUTES") ?? "30",
    );
    const result = await mp.createPixPayment({
      tenantId: order.tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents,
      payerEmail,
      description: `Pedido ${order.orderNumber}`,
      expiresInMinutes: Number.isFinite(pixMinutes) && pixMinutes > 0 ? pixMinutes : 30,
      credentials,
    });

    await this.db
      .update(orders)
      .set({
        paymentMethod: "pix",
        paymentProvider: "mercado_pago",
        paymentGatewayId,
        paymentExternalId: result.paymentId,
        paymentIdempotencyKey: `pix-${order.orderNumber}-${Date.now()}`,
        pixQrCode: result.qrCode,
        pixQrCodeBase64: result.qrCodeBase64,
        pixExpiresAt: result.expiresAt,
      })
      .where(eq(orders.id, order.id));

    return {
      paymentId: result.paymentId,
      status: result.status,
      qrCode: result.qrCode,
      qrCodeBase64: result.qrCodeBase64,
      expiresAt: result.expiresAt,
    };
  }

  private async createCheckoutProPayment(
    tenantId: string,
    order: Order & { items?: Array<{ name: string; quantity: number; price: string }> },
    dto: CreatePaymentDto,
    credentials: GatewayCredentials,
    paymentGatewayId: string | undefined,
    mp: ReturnType<PaymentGatewayFactory["get"]>,
  ) {
    const payerEmail = this.resolvePayerEmail(order, dto);
    const { returnUrl, notificationUrl } = await this.resolvePaymentPublicUrlsAsync(
      tenantId,
      order.orderNumber,
    );
    const items: CheckoutItem[] = (order.items ?? []).map((item) => ({
      title: item.name,
      description: item.name,
      quantity: item.quantity,
      unitPriceCents: Math.round(Number.parseFloat(String(item.price)) * 100),
    }));
    const result = await mp.createCheckout({
      tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: orderTotalCents(order.total),
      currency: String(order.currency ?? "BRL").toUpperCase(),
      payerEmail,
      description: `Pedido ${order.orderNumber}`,
      returnUrl,
      notificationUrl,
      items: items.length > 0 ? items : undefined,
      installments: dto.installments ?? 12,
      credentials,
      metadata: { orderId: order.id },
    });

    await this.db
      .update(orders)
      .set({
        paymentMethod: dto.paymentMethod,
        paymentProvider: "mercado_pago",
        paymentGatewayId,
        paymentExternalId: result.paymentId,
        paymentExternalUrl: result.checkoutUrl,
        paymentIdempotencyKey: `pref-${order.orderNumber}-${Date.now()}`,
      })
      .where(eq(orders.id, order.id));

    return {
      preferenceId: result.paymentId,
      initPoint: result.checkoutUrl,
      sandboxInitPoint: result.checkoutUrl,
    };
  }

  async handleMercadoPagoWebhook(input: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
    requestUrl: string;
    tenantId?: string;
  }) {
    const body = parseWebhookBody(input.rawBody);
    if (isMerchantOrderTopic(body, input.requestUrl)) {
      return { received: true };
    }

    const headers = normalizeHeaders(input.headers);
    const paymentId = extractPaymentId(body, input.requestUrl);
    if (!paymentId) {
      return { received: true };
    }

    const mp = this.paymentGatewayFactory.get("mercado_pago");
    const verified = await this.resolveVerifiedGatewayForWebhook(
      input.rawBody,
      headers,
      mp,
    );
    if (!verified) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    let paymentInfo: PaymentStatusInfo;
    try {
      paymentInfo = await mp.getPaymentStatus(paymentId, verified.credentials);
    } catch {
      throw new BadRequestException("Unable to load payment from Mercado Pago");
    }

    const tenantScope =
      input.tenantId ?? (verified.tenantId ? verified.tenantId : undefined);
    let existing = tenantScope
      ? await this.db.query.orders.findFirst({
          where: and(
            eq(orders.tenantId, tenantScope),
            eq(orders.paymentExternalId, String(paymentId)),
          ),
        })
      : await this.db.query.orders.findFirst({
          where: eq(orders.paymentExternalId, String(paymentId)),
        });

    if (!existing && paymentInfo.externalReference) {
      const ref = paymentInfo.externalReference;
      const byNumberWhere = tenantScope
        ? and(eq(orders.tenantId, tenantScope), eq(orders.orderNumber, ref))
        : eq(orders.orderNumber, ref);
      const candidates = await this.db.select().from(orders).where(byNumberWhere);
      if (candidates.length === 1) {
        existing = candidates[0];
      } else if (candidates.length > 1 && paymentInfo.amountCents != null) {
        existing =
          candidates.find(
            (o) => orderTotalCents(o.total) === paymentInfo.amountCents,
          ) ?? null;
      }
    }

    if (!existing) {
      return { received: true, ignored: true };
    }

    if (tenantScope && existing.tenantId !== tenantScope) {
      return { received: true, ignored: true };
    }

    const extRef = (paymentInfo.externalReference ?? "").trim();
    if (extRef && extRef !== existing.orderNumber) {
      return { received: true, ignored: true, reason: "external_reference_mismatch" };
    }

    if (
      paymentInfo.amountCents !== null &&
      Number.isFinite(paymentInfo.amountCents)
    ) {
      const expected = orderTotalCents(existing.total);
      if (paymentInfo.amountCents !== expected) {
        return { received: true, ignored: true, reason: "amount_mismatch" };
      }
    }

    const status = paymentInfo.status;
    if (PAID_WEBHOOK_STATUSES.has(status)) {
      if (existing.paymentStatus === "approved" || existing.paymentStatus === "authorized") {
        return { received: true, ignored: true, idempotent: true };
      }
      await this.db
        .update(orders)
        .set({
          paymentStatus: status === "authorized" ? "authorized" : "approved",
          paymentExternalId: String(paymentId),
          webhookLastReceivedAt: new Date(),
          paidAt: existing.paidAt ?? new Date(),
        })
        .where(eq(orders.id, existing.id));

      const orderWithCustomer = await this.db.query.orders.findFirst({
        where: eq(orders.id, existing.id),
        with: { customer: true },
      });
      if (orderWithCustomer?.customer?.email) {
        this.orderMailService
          .sendOrderConfirmation(orderWithCustomer, orderWithCustomer.customer)
          .catch((err) => {
            this.logger.error(`Failed to send order confirmation email for ${existing.orderNumber}`, err instanceof Error ? err.stack : String(err));
          });
      }

      return { received: true, updated: true };
    }

    if (
      status === "refunded" ||
      status === "charged_back" ||
      status === "cancelled"
    ) {
      await this.db
        .update(orders)
        .set({
          paymentStatus: mapNormalizedToDbStatus(status),
          paymentExternalId: String(paymentId),
          webhookLastReceivedAt: new Date(),
        })
        .where(eq(orders.id, existing.id));
      return { received: true, updated: true, status };
    }

    if (status === "rejected") {
      await this.db
        .update(orders)
        .set({
          paymentStatus: "rejected",
          paymentExternalId: String(paymentId),
          paymentFailureReason: paymentInfo.statusDetail ?? "Payment rejected",
          webhookLastReceivedAt: new Date(),
        })
        .where(eq(orders.id, existing.id));
      return { received: true, updated: true, status };
    }

    return { received: true, ignored: true, status };
  }

  private async resolveVerifiedGatewayForWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
    mp: ReturnType<PaymentGatewayFactory["get"]>,
  ): Promise<{ credentials: GatewayCredentials; tenantId: string } | null> {
    const globalSecret = this.configService.get<string>("MERCADO_PAGO_WEBHOOK_SECRET");
    if (globalSecret) {
      const credsWebhook: GatewayCredentials = { webhook_secret: globalSecret };
      if (
        mp.verifyWebhookSignature({
          rawBody,
          headers,
          credentials: credsWebhook,
        })
      ) {
        const envToken = this.configService.get<string>("MERCADO_PAGO_ACCESS_TOKEN");
        if (envToken) {
          return {
            credentials: { ...credsWebhook, access_token: envToken },
            tenantId: "",
          };
        }
        const rows = await this.db
          .select()
          .from(tenantPaymentGateways)
          .where(
            and(
              eq(tenantPaymentGateways.provider, "mercado_pago"),
              eq(tenantPaymentGateways.isActive, true),
            ),
          );
        const first = rows[0];
        if (first) {
          const merged = {
            ...(first.credentials as GatewayCredentials),
            webhook_secret: globalSecret,
          };
          return { credentials: merged, tenantId: first.tenantId };
        }
        return null;
      }
    }

    const rows = await this.db
      .select()
      .from(tenantPaymentGateways)
      .where(
        and(
          eq(tenantPaymentGateways.provider, "mercado_pago"),
          eq(tenantPaymentGateways.isActive, true),
        ),
      );
    for (const row of rows) {
      const creds = row.credentials as GatewayCredentials;
      if (!creds?.webhook_secret) continue;
      if (mp.verifyWebhookSignature({ rawBody, headers, credentials: creds })) {
        return { credentials: creds, tenantId: row.tenantId };
      }
    }

    const legacy = headers["x-webhook-signature"];
    if (legacy && globalSecret && legacy === globalSecret) {
      const envToken = this.configService.get<string>("MERCADO_PAGO_ACCESS_TOKEN");
      const first = rows[0];
      if (envToken) {
        return {
          credentials: {
            webhook_secret: globalSecret,
            access_token: envToken,
          },
          tenantId: "",
        };
      }
      if (first) {
        return {
          credentials: first.credentials as GatewayCredentials,
          tenantId: first.tenantId,
        };
      }
    }

    return null;
  }

  assertWebhookSignature(signature: string | undefined) {
    const configured = this.configService.get<string>("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!configured) {
      throw new UnauthorizedException("Webhook secret is not configured");
    }
    if (signature !== configured) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  async getPaymentStatus(tenantId: string, orderNumber: string) {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)),
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return {
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      pixQrCode: order.pixQrCode,
      pixQrCodeBase64: order.pixQrCodeBase64,
      paymentUrl: order.paymentExternalUrl,
    };
  }

  async getEnabledPaymentMethods(tenantId: string) {
    return this.paymentGatewaysService.getEnabledPaymentMethods(tenantId);
  }

  async refundPayment(tenantId: string, orderNumber: string, amountCents?: number) {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)),
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.paymentStatus !== "approved" && order.paymentStatus !== "authorized") {
      throw new BadRequestException("Only approved or authorized payments can be refunded");
    }

    if (!order.paymentExternalId) {
      throw new BadRequestException("Payment external ID not found");
    }

    const gateway = await this.paymentGatewaysService.getPreferredGatewayForTenant(
      tenantId,
      "mercado_pago",
    );
    const accessToken = gateway?.credentials?.access_token;
    if (!accessToken || typeof accessToken !== "string") {
      throw new BadRequestException("Payment not configured for this tenant");
    }

    const credentials = gateway.credentials as GatewayCredentials;
    const mp = this.paymentGatewayFactory.get("mercado_pago");

    const refundResult = await mp.refund({
      providerPaymentId: order.paymentExternalId,
      amountCents,
      credentials,
    });

    const newPaymentStatus = amountCents != null ? "refunded" : "refunded";
    await this.db
      .update(orders)
      .set({
        paymentStatus: newPaymentStatus,
        webhookLastReceivedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    return {
      refundId: refundResult.refundId,
      status: refundResult.status,
      amountCents: refundResult.amountCents,
      paymentStatus: newPaymentStatus,
    };
  }
}

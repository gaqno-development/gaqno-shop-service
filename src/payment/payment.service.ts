import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { orders, tenants } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { CreatePaymentDto, PaymentMethod } from "./dto/payment.dto";

// Mercado Pago SDK mock - will be replaced with actual SDK
interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  external_reference: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
}

const PAID_WEBHOOK_STATUSES = new Set(["approved", "authorized"]);
const IN_FLIGHT_PAYMENT_STATUSES = new Set(["pending", "in_process", "authorized", "approved"]);

@Injectable()
export class PaymentService {
  constructor(
    @Inject("DATABASE") private db: any,
    private configService: ConfigService
  ) {}

  async createPayment(tenantId: string, dto: CreatePaymentDto) {
    // Get order
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(orders.tenantId, tenantId),
        eq(orders.orderNumber, dto.orderNumber)
      ),
      with: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.paymentExternalId && IN_FLIGHT_PAYMENT_STATUSES.has(String(order.paymentStatus))) {
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

    // Get tenant Mercado Pago credentials
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    const accessToken = tenant?.mercadoPagoAccessToken;

    if (!accessToken) {
      throw new BadRequestException("Payment not configured for this tenant");
    }

    // Build preference items
    const items = order.items.map((item: any) => ({
      title: item.name,
      unit_price: parseFloat(item.price),
      quantity: item.quantity,
    }));

    // Create preference based on payment method
    if (dto.paymentMethod === PaymentMethod.PIX) {
      return this.createPixPayment(order, items, accessToken, dto);
    }

    // For credit/debit cards and other methods
    return this.createStandardPayment(order, items, accessToken, dto);
  }

  private async createPixPayment(
    order: any,
    items: any[],
    accessToken: string,
    dto: CreatePaymentDto
  ) {
    // TODO: Integrate with Mercado Pago SDK for PIX
    // This is a mock implementation

    const mockPayment: MercadoPagoPayment = {
      id: Date.now(),
      status: "pending",
      status_detail: "pending_waiting_payment",
      transaction_amount: parseFloat(order.total),
      external_reference: order.orderNumber,
      point_of_interaction: {
        transaction_data: {
          qr_code: "00020126580014BR.GOV.BCB.PIX0136mock-qr-code-for-testing",
          qr_code_base64:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      },
    };

    // Update order with payment info
    await this.db
      .update(orders)
      .set({
        paymentMethod: "pix",
        paymentExternalId: mockPayment.id.toString(),
        pixQrCode: mockPayment.point_of_interaction?.transaction_data?.qr_code,
        pixQrCodeBase64:
          mockPayment.point_of_interaction?.transaction_data?.qr_code_base64,
      })
      .where(eq(orders.id, order.id));

    return {
      paymentId: mockPayment.id,
      status: mockPayment.status,
      qrCode: mockPayment.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64:
        mockPayment.point_of_interaction?.transaction_data?.qr_code_base64,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  private async createStandardPayment(
    order: any,
    items: any[],
    accessToken: string,
    dto: CreatePaymentDto
  ) {
    // TODO: Integrate with Mercado Pago SDK for credit/debit cards
    // This is a mock implementation

    const mockPreference: MercadoPagoPreference = {
      id: `pref_${Date.now()}`,
      init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_${Date.now()}`,
      sandbox_init_point: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_${Date.now()}`,
    };

    // Update order with payment info
    await this.db
      .update(orders)
      .set({
        paymentMethod: dto.paymentMethod,
        paymentExternalId: mockPreference.id,
        paymentExternalUrl: mockPreference.init_point,
      })
      .where(eq(orders.id, order.id));

    return {
      preferenceId: mockPreference.id,
      initPoint: mockPreference.init_point,
      sandboxInitPoint: mockPreference.sandbox_init_point,
    };
  }

  async handleWebhook(tenantId: string | undefined, data: any) {
    const { type } = data;

    if (type !== "payment") {
      return { received: true };
    }
    const paymentExternalId =
      data?.dataId ?? data?.id ?? data?.data?.id;
    if (!paymentExternalId) {
      throw new BadRequestException("payment id is required");
    }

    const existing = tenantId
      ? await this.db.query.orders.findFirst({
          where: and(
            eq(orders.tenantId, tenantId),
            eq(orders.paymentExternalId, String(paymentExternalId)),
          ),
        })
      : await this.db.query.orders.findFirst({
          where: eq(orders.paymentExternalId, String(paymentExternalId)),
        });
    if (!existing) {
      return { received: true, ignored: true };
    }

    const status =
      String(data?.status ?? data?.data?.status ?? "")
        .trim()
        .toLowerCase();
    if (!PAID_WEBHOOK_STATUSES.has(status)) {
      return { received: true, ignored: true, status };
    }

    const externalReference = String(
      data?.externalReference ??
        data?.external_reference ??
        data?.data?.externalReference ??
        data?.data?.external_reference ??
        "",
    ).trim();
    if (externalReference && externalReference !== existing.orderNumber) {
      return { received: true, ignored: true, reason: "external_reference_mismatch" };
    }

    const webhookAmount = Number(
      data?.transactionAmount ??
        data?.transaction_amount ??
        data?.data?.transactionAmount ??
        data?.data?.transaction_amount,
    );
    if (Number.isFinite(webhookAmount)) {
      const orderTotal = Number(existing.total);
      if (Number.isFinite(orderTotal) && Number(webhookAmount.toFixed(2)) !== Number(orderTotal.toFixed(2))) {
        return { received: true, ignored: true, reason: "amount_mismatch" };
      }
    }

    const webhookCurrency = String(
      data?.currency ?? data?.data?.currency ?? "",
    ).trim().toUpperCase();
    const orderCurrency = String(existing.currency ?? "BRL").trim().toUpperCase();
    if (webhookCurrency && webhookCurrency !== orderCurrency) {
      return { received: true, ignored: true, reason: "currency_mismatch" };
    }

    if (existing.paymentStatus === "approved" || existing.paymentStatus === "authorized") {
      return { received: true, ignored: true, idempotent: true };
    }

    await this.db
      .update(orders)
      .set({
        paymentStatus: status === "authorized" ? "authorized" : "approved",
        webhookLastReceivedAt: new Date(),
        paidAt: existing.paidAt ?? new Date(),
      })
      .where(eq(orders.id, existing.id));

    return { received: true, updated: true };
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
      where: and(
        eq(orders.tenantId, tenantId),
        eq(orders.orderNumber, orderNumber)
      ),
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
}

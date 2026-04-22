import * as crypto from "node:crypto";
import { MercadoPagoProvider } from "./mercado-pago.provider";
import type {
  GatewayCredentials,
  PixInput,
  CheckoutInput,
  WebhookVerifyInput,
} from "../payment-gateway.interface";

type MpResponse = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  init_point?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  date_of_expiration?: string;
};

interface MpStubs {
  paymentCreate?: jest.Mock;
  paymentGet?: jest.Mock;
  paymentSearch?: jest.Mock;
  preferenceCreate?: jest.Mock;
  userGet?: jest.Mock;
}

function makeProvider(stubs: MpStubs = {}): MercadoPagoProvider {
  const provider = new MercadoPagoProvider();
  (provider as unknown as { buildClients: (cred: GatewayCredentials) => unknown })
    .buildClients = () => ({
    payment: {
      create: stubs.paymentCreate ?? jest.fn(),
      get: stubs.paymentGet ?? jest.fn(),
      search: stubs.paymentSearch ?? jest.fn(),
    },
    preference: {
      create: stubs.preferenceCreate ?? jest.fn(),
    },
    user: {
      get: stubs.userGet ?? jest.fn(),
    },
  });
  return provider;
}

function baseCheckoutInput(over: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    tenantId: "tenant-1",
    orderId: "order-uuid",
    orderNumber: "ORD-0001",
    amountCents: 12345,
    currency: "BRL",
    payerEmail: "buyer@test.com",
    description: "Test order",
    returnUrl: "https://shop.test/pedido/ORD-0001",
    notificationUrl: "https://api.test/webhooks/payments/mercado_pago",
    statementDescriptor: "FIFIADOCES",
    installments: 12,
    credentials: { access_token: "TEST-123" },
    ...over,
  };
}

function basePixInput(over: Partial<PixInput> = {}): PixInput {
  return {
    tenantId: "tenant-1",
    orderId: "order-uuid",
    orderNumber: "ORD-0001",
    amountCents: 5000,
    payerEmail: "buyer@test.com",
    description: "Test PIX",
    expiresInMinutes: 10,
    credentials: { access_token: "TEST-123" },
    ...over,
  };
}

describe("MercadoPagoProvider", () => {
  describe("createPixPayment", () => {
    it("returns qrCode, qrCodeBase64 and expiresAt", async () => {
      const now = new Date("2024-01-01T00:00:00Z");
      jest.useFakeTimers().setSystemTime(now);
      const response: MpResponse = {
        id: 987654321,
        status: "pending",
        date_of_expiration: "2024-01-01T00:10:00Z",
        point_of_interaction: {
          transaction_data: {
            qr_code: "00020126580014BR.GOV.BCB.PIX-code",
            qr_code_base64: "iVBORw0KGgoAAAANSUhEUg==",
          },
        },
      };
      const paymentCreate = jest.fn().mockResolvedValue(response);
      const provider = makeProvider({ paymentCreate });

      const result = await provider.createPixPayment(basePixInput());

      expect(result.provider).toBe("mercado_pago");
      expect(result.paymentId).toBe("987654321");
      expect(result.qrCode).toBe("00020126580014BR.GOV.BCB.PIX-code");
      expect(result.qrCodeBase64).toBe("iVBORw0KGgoAAAANSUhEUg==");
      expect(result.expiresAt.toISOString()).toBe("2024-01-01T00:10:00.000Z");
      expect(result.status).toBe("pending");
      jest.useRealTimers();
    });

    it("sends amount in reais (cents/100), external_reference and idempotencyKey", async () => {
      const paymentCreate = jest.fn().mockResolvedValue({
        id: 1,
        status: "pending",
        point_of_interaction: {
          transaction_data: {
            qr_code: "x",
            qr_code_base64: "y",
          },
        },
      });
      const provider = makeProvider({ paymentCreate });
      await provider.createPixPayment(basePixInput({ amountCents: 12345 }));

      const [call] = paymentCreate.mock.calls;
      expect(call[0].body.transaction_amount).toBe(123.45);
      expect(call[0].body.payment_method_id).toBe("pix");
      expect(call[0].body.external_reference).toBe("ORD-0001");
      expect(call[0].body.payer.email).toBe("buyer@test.com");
      expect(call[0].requestOptions.idempotencyKey).toBe("pix-ORD-0001");
    });

    it("throws when MP response misses QR data", async () => {
      const paymentCreate = jest.fn().mockResolvedValue({
        id: 1,
        status: "pending",
        point_of_interaction: { transaction_data: {} },
      });
      const provider = makeProvider({ paymentCreate });
      await expect(provider.createPixPayment(basePixInput())).rejects.toThrow(
        /invalid MP PIX response/i,
      );
    });

    it("throws when credentials.access_token is missing", async () => {
      const provider = makeProvider();
      await expect(
        provider.createPixPayment(basePixInput({ credentials: {} })),
      ).rejects.toThrow(/access_token/i);
    });
  });

  describe("createCheckout (Checkout Pro preference)", () => {
    it("returns preferenceId and initPoint", async () => {
      const preferenceCreate = jest.fn().mockResolvedValue({
        id: "pref_abc",
        init_point: "https://mp.com/checkout/pref_abc",
      });
      const provider = makeProvider({ preferenceCreate });
      const result = await provider.createCheckout(baseCheckoutInput());
      expect(result.paymentId).toBe("pref_abc");
      expect(result.checkoutUrl).toBe("https://mp.com/checkout/pref_abc");
      expect(result.status).toBe("pending");
    });

    it("sends items with unit_price in reais, back_urls, notification_url and idempotency", async () => {
      const preferenceCreate = jest.fn().mockResolvedValue({
        id: "pref_1",
        init_point: "https://mp.com/1",
      });
      const provider = makeProvider({ preferenceCreate });
      await provider.createCheckout(
        baseCheckoutInput({
          items: [
            {
              title: "Bolo",
              description: "Doce",
              quantity: 2,
              unitPriceCents: 5000,
              categoryId: "foods",
            },
          ],
        }),
      );
      const [call] = preferenceCreate.mock.calls;
      const body = call[0].body;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].unit_price).toBe(50);
      expect(body.items[0].quantity).toBe(2);
      expect(body.items[0].currency_id).toBe("BRL");
      expect(body.external_reference).toBe("ORD-0001");
      expect(body.back_urls.success).toContain("ORD-0001");
      expect(body.notification_url).toBe(
        "https://api.test/webhooks/payments/mercado_pago",
      );
      expect(body.auto_return).toBe("approved");
      expect(body.payment_methods.installments).toBe(12);
      expect(call[0].requestOptions.idempotencyKey).toBe("pref-ORD-0001");
    });

    it("omits back_urls and notification_url when returnUrl is not public HTTPS", async () => {
      const preferenceCreate = jest.fn().mockResolvedValue({
        id: "pref_1",
        init_point: "https://mp.com/1",
      });
      const provider = makeProvider({ preferenceCreate });
      await provider.createCheckout(
        baseCheckoutInput({
          returnUrl: "http://localhost:3000/pedido/ORD-0001",
          notificationUrl: "http://localhost:3000/webhook",
        }),
      );
      const body = preferenceCreate.mock.calls[0][0].body;
      expect(body.back_urls).toBeUndefined();
      expect(body.notification_url).toBeUndefined();
      expect(body.auto_return).toBeUndefined();
    });

    it("builds single item from description when items[] not provided", async () => {
      const preferenceCreate = jest.fn().mockResolvedValue({
        id: "pref_1",
        init_point: "https://mp.com/1",
      });
      const provider = makeProvider({ preferenceCreate });
      await provider.createCheckout(
        baseCheckoutInput({ items: undefined, amountCents: 9999 }),
      );
      const body = preferenceCreate.mock.calls[0][0].body;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].unit_price).toBe(99.99);
      expect(body.items[0].title).toBe("Test order");
    });
  });

  describe("getPaymentStatus", () => {
    it("normalizes MP response to PaymentStatusInfo", async () => {
      const paymentGet = jest.fn().mockResolvedValue({
        id: 111,
        status: "approved",
        status_detail: "accredited",
        external_reference: "ORD-0001",
        transaction_amount: 50,
      });
      const provider = makeProvider({ paymentGet });
      const info = await provider.getPaymentStatus("111", {
        access_token: "x",
      });
      expect(info.paymentId).toBe("111");
      expect(info.status).toBe("approved");
      expect(info.statusDetail).toBe("accredited");
      expect(info.externalReference).toBe("ORD-0001");
      expect(info.amountCents).toBe(5000);
    });

    it("defaults status=pending when MP does not return status", async () => {
      const paymentGet = jest.fn().mockResolvedValue({ id: 22 });
      const provider = makeProvider({ paymentGet });
      const info = await provider.getPaymentStatus("22", {
        access_token: "x",
      });
      expect(info.status).toBe("pending");
      expect(info.amountCents).toBeNull();
    });
  });

  describe("searchPaymentsByReference", () => {
    it("prefers the approved payment when multiple exist", async () => {
      const paymentSearch = jest.fn().mockResolvedValue({
        results: [
          {
            id: 1,
            status: "pending",
            external_reference: "ORD-1",
          },
          {
            id: 2,
            status: "approved",
            status_detail: "accredited",
            external_reference: "ORD-1",
          },
        ],
      });
      const provider = makeProvider({ paymentSearch });
      const info = await provider.searchPaymentsByReference("ORD-1", {
        access_token: "x",
      });
      expect(info).not.toBeNull();
      expect(info?.paymentId).toBe("2");
      expect(info?.status).toBe("approved");
    });

    it("returns null when no results", async () => {
      const paymentSearch = jest.fn().mockResolvedValue({ results: [] });
      const provider = makeProvider({ paymentSearch });
      const result = await provider.searchPaymentsByReference("ORD-X", {
        access_token: "x",
      });
      expect(result).toBeNull();
    });
  });

  describe("verifyWebhookSignature (HMAC)", () => {
    const secret = "test-secret";

    function signedRequest(
      dataId: string,
      requestId: string,
      ts: string,
      body: Record<string, unknown>,
    ): WebhookVerifyInput {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(manifest)
        .digest("hex");
      return {
        rawBody: JSON.stringify(body),
        headers: {
          "x-signature": `ts=${ts},v1=${hmac}`,
          "x-request-id": requestId,
        },
        credentials: { webhook_secret: secret },
      };
    }

    it("accepts a correctly signed request", () => {
      const provider = makeProvider();
      const input = signedRequest("payment-1", "req-1", "1700000000", {
        data: { id: "payment-1" },
      });
      expect(provider.verifyWebhookSignature(input)).toBe(true);
    });

    it("rejects when signature mismatches", () => {
      const provider = makeProvider();
      const input = signedRequest("payment-1", "req-1", "1700000000", {
        data: { id: "payment-1" },
      });
      input.headers["x-signature"] = "ts=1700000000,v1=deadbeef";
      expect(provider.verifyWebhookSignature(input)).toBe(false);
    });

    it("rejects when webhook_secret is missing", () => {
      const provider = makeProvider();
      const input = signedRequest("payment-1", "req-1", "1700000000", {
        data: { id: "payment-1" },
      });
      const noSecret: WebhookVerifyInput = { ...input, credentials: {} };
      expect(provider.verifyWebhookSignature(noSecret)).toBe(false);
    });

    it("rejects when x-signature or x-request-id headers are absent", () => {
      const provider = makeProvider();
      expect(
        provider.verifyWebhookSignature({
          rawBody: "{}",
          headers: {},
          credentials: { webhook_secret: secret },
        }),
      ).toBe(false);
    });

    it("rejects when body cannot be parsed as JSON", () => {
      const provider = makeProvider();
      expect(
        provider.verifyWebhookSignature({
          rawBody: "not-json",
          headers: {
            "x-signature": "ts=1,v1=whatever",
            "x-request-id": "r",
          },
          credentials: { webhook_secret: secret },
        }),
      ).toBe(false);
    });
  });

  describe("parseWebhook", () => {
    it("extracts paymentId from data.id and uses action as eventType", () => {
      const provider = makeProvider();
      const evt = provider.parseWebhook({
        action: "payment.updated",
        type: "payment",
        data: { id: "98765" },
      });
      expect(evt.provider).toBe("mercado_pago");
      expect(evt.paymentId).toBe("98765");
      expect(evt.eventType).toBe("payment.updated");
    });

    it("returns unknown eventType when nothing matches", () => {
      const provider = makeProvider();
      const evt = provider.parseWebhook({});
      expect(evt.eventType).toBe("unknown");
      expect(evt.paymentId).toBeUndefined();
    });
  });

  describe("validateCredentials", () => {
    it("returns valid=true when user.get succeeds", async () => {
      const userGet = jest.fn().mockResolvedValue({ id: 42, email: "x@y" });
      const provider = makeProvider({ userGet });
      const res = await provider.validateCredentials({
        credentials: { access_token: "TEST-OK" },
      });
      expect(res.valid).toBe(true);
    });

    it("returns valid=false with reason when user.get rejects", async () => {
      const userGet = jest.fn().mockRejectedValue(new Error("401 invalid token"));
      const provider = makeProvider({ userGet });
      const res = await provider.validateCredentials({
        credentials: { access_token: "WRONG" },
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/invalid/i);
    });

    it("returns valid=false when access_token is absent (no API call)", async () => {
      const userGet = jest.fn();
      const provider = makeProvider({ userGet });
      const res = await provider.validateCredentials({ credentials: {} });
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/access_token/i);
      expect(userGet).not.toHaveBeenCalled();
    });
  });
});

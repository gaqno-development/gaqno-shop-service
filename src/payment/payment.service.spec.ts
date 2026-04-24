import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentService } from "./payment.service";
import { PaymentGatewaysService } from "../payment-gateways/payment-gateways.service";

describe("PaymentService", () => {
  it("rejects webhook when secret is not configured", () => {
    const db = {} as any;
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const gateways = {} as PaymentGatewaysService;
    const service = new PaymentService(db, config, gateways);

    expect(() => service.assertWebhookSignature("invalid")).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects webhook when signature is invalid", () => {
    const db = {} as any;
    const config = {
      get: jest.fn().mockReturnValue("expected-signature"),
    } as unknown as ConfigService;
    const gateways = {} as PaymentGatewaysService;
    const service = new PaymentService(db, config, gateways);

    expect(() => service.assertWebhookSignature("invalid")).toThrow(
      UnauthorizedException,
    );
  });

  it("returns idempotent response when webhook is duplicated", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-1",
      paymentStatus: "approved",
      total: "100.00",
      currency: "BRL",
      paidAt: new Date(),
      tenantId: "tenant-1",
      paymentGatewayId: "gateway-1",
    });
    const updateWhere = jest.fn();
    const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
    const db = {
      query: {
        orders: {
          findFirst,
        },
      },
      update: jest.fn().mockReturnValue({ set: updateSet }),
    };
    const config = {
      get: jest.fn().mockReturnValue("secret"),
    } as unknown as ConfigService;
    const gateways = {
      getGatewayById: jest.fn().mockResolvedValue({
        credentials: { webhook_secret: "secret" },
      }),
    } as unknown as PaymentGatewaysService;
    const service = new PaymentService(db as any, config, gateways);

    const result = await service.handleWebhook("tenant-1", "secret", {
      type: "payment",
      dataId: "ext-123",
      status: "approved",
      transactionAmount: 100,
      currency: "BRL",
      externalReference: "ORD-1",
    });

    expect(result).toEqual({ received: true, ignored: true, idempotent: true });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("ignores webhook when payment status is not approved", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-1",
      paymentStatus: "pending",
      total: "100.00",
      currency: "BRL",
      paidAt: null,
      tenantId: "tenant-1",
      paymentGatewayId: "gateway-1",
    });
    const db = {
      query: {
        orders: { findFirst },
      },
      update: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue("secret"),
    } as unknown as ConfigService;
    const gateways = {
      getGatewayById: jest.fn().mockResolvedValue({
        credentials: { webhook_secret: "secret" },
      }),
    } as unknown as PaymentGatewaysService;
    const service = new PaymentService(db as any, config, gateways);

    const result = await service.handleWebhook(
      "tenant-1",
      "secret",
      {
        type: "payment",
        data: { id: "ext-123", status: "pending" },
        transactionAmount: 100,
        externalReference: "ORD-1",
        currency: "BRL",
      },
    );

    expect(result).toEqual({ received: true, ignored: true, status: "pending" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("ignores approved webhook when amount mismatches order total", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-1",
      paymentStatus: "pending",
      total: "250.00",
      currency: "BRL",
      paidAt: null,
      tenantId: "tenant-1",
      paymentGatewayId: "gateway-1",
    });
    const db = {
      query: {
        orders: { findFirst },
      },
      update: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue("secret"),
    } as unknown as ConfigService;
    const gateways = {
      getGatewayById: jest.fn().mockResolvedValue({
        credentials: { webhook_secret: "secret" },
      }),
    } as unknown as PaymentGatewaysService;
    const service = new PaymentService(db as any, config, gateways);

    const result = await service.handleWebhook(
      "tenant-1",
      "secret",
      {
        type: "payment",
        dataId: "ext-123",
        status: "approved",
        transactionAmount: 200,
        externalReference: "ORD-1",
        currency: "BRL",
      },
    );

    expect(result).toEqual({ received: true, ignored: true, reason: "amount_mismatch" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns existing payment when payment already initiated", async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: "order-1",
        orderNumber: "ORD-1",
        paymentStatus: "pending",
        paymentExternalId: "ext-1",
        paymentExternalUrl: "https://pay",
        pixQrCode: null,
        pixQrCodeBase64: null,
      });
    const db = {
      query: {
        orders: { findFirst },
      },
      update: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue("secret"),
    } as unknown as ConfigService;
    const gateways = {
      getPreferredGatewayForTenant: jest.fn().mockResolvedValue({
        id: "gateway-1",
        credentials: { access_token: "token" },
      }),
    } as unknown as PaymentGatewaysService;
    const service = new PaymentService(db as any, config, gateways);

    const result = await service.createPayment("tenant-1", {
      orderNumber: "ORD-1",
      paymentMethod: "pix",
    } as any);

    expect(result).toEqual({
      orderNumber: "ORD-1",
      paymentExternalId: "ext-1",
      paymentStatus: "pending",
      paymentUrl: "https://pay",
      qrCode: null,
      qrCodeBase64: null,
    });
    expect(db.update).not.toHaveBeenCalled();
  });
});

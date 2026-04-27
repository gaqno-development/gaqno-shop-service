import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentService } from "./payment.service";
import { PaymentGatewaysService } from "../payment-gateways/payment-gateways.service";
import { PaymentGatewayFactory } from "../payment-gateways/payment-gateway.factory";

const noopFactory = {} as PaymentGatewayFactory;
const noopMailService = { sendOrderConfirmation: jest.fn() } as any;

function makeService(overrides: { db?: any; config?: any; gateways?: any; factory?: any } = {}) {
  const db = overrides.db ?? {} as any;
  const config = overrides.config ?? { get: jest.fn() } as unknown as ConfigService;
  const gateways = overrides.gateways ?? {} as PaymentGatewaysService;
  const factory = overrides.factory ?? noopFactory;
  return new PaymentService(db, config, gateways, factory, noopMailService);
}

describe("PaymentService", () => {
  it("rejects webhook when secret is not configured", () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = makeService({ config });

    expect(() => service.assertWebhookSignature("invalid")).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects webhook when signature is invalid", () => {
    const config = {
      get: jest.fn().mockReturnValue("expected-signature"),
    } as unknown as ConfigService;
    const service = makeService({ config });

    expect(() => service.assertWebhookSignature("invalid")).toThrow(
      UnauthorizedException,
    );
  });

  it("returns existing payment when payment already initiated", async () => {
    const findFirst = jest.fn().mockResolvedValueOnce({
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
    const service = makeService({ db, config, factory: noopFactory });

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

  it("getEnabledPaymentMethods delegates to PaymentGatewaysService", async () => {
    const getEnabledPaymentMethods = jest
      .fn()
      .mockResolvedValue(["credit_card", "pix", "boleto"]);
    const gateways = {
      getEnabledPaymentMethods,
    } as unknown as PaymentGatewaysService;
    const service = makeService({ factory: noopFactory, gateways });
    await expect(service.getEnabledPaymentMethods("t-1")).resolves.toEqual([
      "credit_card",
      "pix",
      "boleto",
    ]);
    expect(getEnabledPaymentMethods).toHaveBeenCalledWith("t-1");
  });

  describe("refundPayment", () => {
    it("throws NotFoundException when order does not exist", async () => {
      const db = {
        query: { orders: { findFirst: jest.fn().mockResolvedValue(null) } },
      } as any;
      const service = makeService({ db });

      await expect(
        service.refundPayment("tenant-1", "ORD-999"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when payment is not approved", async () => {
      const db = {
        query: {
          orders: {
            findFirst: jest.fn().mockResolvedValue({
              id: "order-1",
              orderNumber: "ORD-1",
              paymentStatus: "pending",
              paymentExternalId: "ext-1",
            }),
          },
        },
      } as any;
      const service = makeService({ db });

      await expect(
        service.refundPayment("tenant-1", "ORD-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when paymentExternalId is missing", async () => {
      const db = {
        query: {
          orders: {
            findFirst: jest.fn().mockResolvedValue({
              id: "order-1",
              orderNumber: "ORD-1",
              paymentStatus: "approved",
              paymentExternalId: null,
            }),
          },
        },
      } as any;
      const service = makeService({ db });

      await expect(
        service.refundPayment("tenant-1", "ORD-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("calls gateway refund and updates order status", async () => {
      const updateWhere = jest.fn().mockResolvedValue(undefined);
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });

      const db = {
        query: {
          orders: {
            findFirst: jest.fn().mockResolvedValue({
              id: "order-1",
              orderNumber: "ORD-1",
              paymentStatus: "approved",
              paymentExternalId: "mp-payment-123",
              total: "100.00",
            }),
          },
        },
        update: jest.fn().mockReturnValue({ set: updateSet }),
      } as any;

      const mockRefund = jest.fn().mockResolvedValue({
        refundId: "refund-456",
        status: "refunded",
        amountCents: 10000,
      });
      const mockGateway = {
        provider: "mercado_pago",
        refund: mockRefund,
      } as any;
      const factory = { get: jest.fn().mockReturnValue(mockGateway) } as unknown as PaymentGatewayFactory;
      const gateways = {
        getPreferredGatewayForTenant: jest.fn().mockResolvedValue({
          id: "gateway-1",
          credentials: { access_token: "token" },
        }),
      } as unknown as PaymentGatewaysService;

      const service = makeService({ db, factory, gateways });
      const result = await service.refundPayment("tenant-1", "ORD-1");

      expect(result.refundId).toBe("refund-456");
      expect(result.status).toBe("refunded");
      expect(result.amountCents).toBe(10000);
      expect(result.paymentStatus).toBe("refunded");
      expect(mockRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          providerPaymentId: "mp-payment-123",
          credentials: expect.objectContaining({ access_token: "token" }),
        }),
      );
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: "refunded",
        }),
      );
    });

    it("supports partial refund with amountCents", async () => {
      const updateWhere = jest.fn().mockResolvedValue(undefined);
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });

      const db = {
        query: {
          orders: {
            findFirst: jest.fn().mockResolvedValue({
              id: "order-1",
              orderNumber: "ORD-1",
              paymentStatus: "approved",
              paymentExternalId: "mp-payment-123",
              total: "100.00",
            }),
          },
        },
        update: jest.fn().mockReturnValue({ set: updateSet }),
      } as any;

      const mockRefund = jest.fn().mockResolvedValue({
        refundId: "refund-789",
        status: "refunded",
        amountCents: 3000,
      });
      const mockGateway = {
        provider: "mercado_pago",
        refund: mockRefund,
      } as any;
      const factory = { get: jest.fn().mockReturnValue(mockGateway) } as unknown as PaymentGatewayFactory;
      const gateways = {
        getPreferredGatewayForTenant: jest.fn().mockResolvedValue({
          id: "gateway-1",
          credentials: { access_token: "token" },
        }),
      } as unknown as PaymentGatewaysService;

      const service = makeService({ db, factory, gateways });
      await service.refundPayment("tenant-1", "ORD-1", 3000);

      expect(mockRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          providerPaymentId: "mp-payment-123",
          amountCents: 3000,
        }),
      );
    });
  });
});

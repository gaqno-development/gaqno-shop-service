import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentService } from "./payment.service";
import { PaymentGatewaysService } from "../payment-gateways/payment-gateways.service";
import { PaymentGatewayFactory } from "../payment-gateways/payment-gateway.factory";

const noopFactory = {} as PaymentGatewayFactory;

describe("PaymentService", () => {
  it("rejects webhook when secret is not configured", () => {
    const db = {} as any;
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const gateways = {} as PaymentGatewaysService;
    const service = new PaymentService(db, config, gateways, noopFactory);

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
    const service = new PaymentService(db, config, gateways, noopFactory);

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
    const service = new PaymentService(db as any, config, gateways, noopFactory);

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

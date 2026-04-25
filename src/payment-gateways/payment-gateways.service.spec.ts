import { PaymentGatewaysService } from "./payment-gateways.service";
import { tenantPaymentGateways } from "../database/schema/tenant";
import { PaymentGatewayFactory } from "./payment-gateway.factory";

function drizzleSelectChain(rows: unknown[]) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => Promise.resolve(rows)),
      }),
    }),
  };
}

describe("PaymentGatewaysService.getEnabledPaymentMethods", () => {
  const factory = {} as PaymentGatewayFactory;
  const core = ["credit_card", "pix", "boleto"] as const;

  it("returns [] when there is no Mercado Pago gateway row", async () => {
    const db = drizzleSelectChain([]);
    const service = new PaymentGatewaysService(db as never, factory);
    await expect(
      service.getEnabledPaymentMethods("tenant-a"),
    ).resolves.toEqual([]);
    expect(db.select).toHaveBeenCalled();
  });

  it("returns [] when the gateway row exists but isActive is false", async () => {
    const db = drizzleSelectChain([
      {
        id: "g1",
        tenantId: "tenant-a",
        provider: "mercado_pago",
        isActive: false,
        isDefault: true,
      },
    ]);
    const service = new PaymentGatewaysService(db as never, factory);
    await expect(
      service.getEnabledPaymentMethods("tenant-a"),
    ).resolves.toEqual([]);
  });

  it("returns credit_card, pix, boleto when Mercado Pago gateway is active", async () => {
    const db = drizzleSelectChain([
      {
        id: "g1",
        tenantId: "tenant-a",
        provider: "mercado_pago",
        isActive: true,
        isDefault: true,
        credentials: {},
      },
    ]);
    const service = new PaymentGatewaysService(db as never, factory);
    await expect(
      service.getEnabledPaymentMethods("tenant-a"),
    ).resolves.toEqual([...core]);
  });

  it("queries tenant payment gateways (from/where) for mercado pago", async () => {
    const from = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
    });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    const service = new PaymentGatewaysService(db as never, factory);
    await service.getEnabledPaymentMethods("tenant-b");
    expect(db.select).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith(tenantPaymentGateways);
  });
});

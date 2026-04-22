import { NotFoundException } from "@nestjs/common";
import { PaymentGatewayFactory } from "./payment-gateway.factory";
import { MercadoPagoProvider } from "./providers/mercado-pago.provider";
import { StripeProvider } from "./providers/stripe.provider";
import { PagSeguroProvider } from "./providers/pagseguro.provider";

describe("PaymentGatewayFactory", () => {
  let factory: PaymentGatewayFactory;
  let mp: MercadoPagoProvider;
  let stripe: StripeProvider;
  let pag: PagSeguroProvider;

  beforeEach(() => {
    mp = new MercadoPagoProvider();
    stripe = new StripeProvider();
    pag = new PagSeguroProvider();
    factory = new PaymentGatewayFactory(mp, stripe, pag);
  });

  it("resolves mercado_pago provider", () => {
    expect(factory.get("mercado_pago")).toBe(mp);
  });

  it("resolves stripe provider (stub)", () => {
    expect(factory.get("stripe")).toBe(stripe);
  });

  it("resolves pagseguro provider (stub)", () => {
    expect(factory.get("pagseguro")).toBe(pag);
  });

  it("throws NotFoundException for unknown provider", () => {
    expect(() => factory.get("acme" as never)).toThrow(NotFoundException);
  });

  it("list() returns all registered providers", () => {
    expect(factory.list()).toEqual(
      expect.arrayContaining(["mercado_pago", "stripe", "pagseguro"])
    );
  });
});

describe("StripeProvider (stub)", () => {
  const stripe = new StripeProvider();

  it("createCheckout throws NotImplementedException", async () => {
    await expect(
      stripe.createCheckout({
        tenantId: "t",
        orderId: "o",
        orderNumber: "ORD-1",
        amountCents: 100,
        currency: "BRL",
        payerEmail: "a@b.com",
        description: "Test",
        returnUrl: "https://x",
        notificationUrl: "https://x/webhook",
        credentials: { access_token: "stub" },
      })
    ).rejects.toThrow(/not implemented/i);
  });

  it("validateCredentials returns valid=false with reason", async () => {
    const result = await stripe.validateCredentials({ credentials: {} });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not implemented/i);
  });
});

describe("MercadoPagoProvider.validateCredentials", () => {
  const mp = new MercadoPagoProvider();

  it("valid=false when access_token is missing (no API call)", async () => {
    const result = await mp.validateCredentials({ credentials: {} });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/access_token/i);
  });
});

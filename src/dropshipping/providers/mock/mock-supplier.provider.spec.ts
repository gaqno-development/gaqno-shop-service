import { MockSupplierProvider } from "./mock-supplier.provider";

describe("MockSupplierProvider", () => {
  let provider: MockSupplierProvider;

  beforeEach(() => {
    provider = new MockSupplierProvider();
  });

  it("reports aliexpress code", () => {
    expect(provider.code).toBe("aliexpress");
  });

  describe("search", () => {
    it("returns paginated fixture items", async () => {
      const result = await provider.search({
        shipToCountry: "BR",
        page: 1,
        pageSize: 5,
      });

      expect(result.items).toHaveLength(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(5);
      expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    });

    it("filters by keyword", async () => {
      const result = await provider.search({
        keyword: "camiseta",
        shipToCountry: "BR",
        page: 1,
        pageSize: 10,
      });

      result.items.forEach((item) => {
        expect(item.title.toLowerCase()).toContain("camiseta");
      });
    });

    it("filters by price range in USD", async () => {
      const result = await provider.search({
        minPriceUsd: 10,
        maxPriceUsd: 20,
        shipToCountry: "BR",
        page: 1,
        pageSize: 10,
      });

      result.items.forEach((item) => {
        expect(item.priceUsd.min).toBeGreaterThanOrEqual(10);
        expect(item.priceUsd.max).toBeLessThanOrEqual(20);
      });
    });
  });

  describe("getDetails", () => {
    it("returns full detail with variations", async () => {
      const detail = await provider.getDetails("mock-1");

      expect(detail.externalId).toBe("mock-1");
      expect(detail.variations.length).toBeGreaterThan(0);
      expect(detail.estimatedDeliveryDays.min).toBeGreaterThan(0);
      expect(detail.estimatedDeliveryDays.max).toBeGreaterThanOrEqual(
        detail.estimatedDeliveryDays.min,
      );
    });

    it("throws for unknown product", async () => {
      await expect(provider.getDetails("does-not-exist")).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("placeOrder", () => {
    const baseRequest = {
      externalProductId: "mock-1",
      quantity: 1,
      buyerTaxNumber: "12345678900",
      shippingAddress: {
        fullName: "Ana Silva",
        phone: "+5511999999999",
        email: "ana@example.com",
        postalCode: "01310100",
        street: "Av. Paulista",
        number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        stateCode: "SP",
        countryCode: "BR",
      },
    };

    it("places order successfully by default", async () => {
      const result = await provider.placeOrder(baseRequest);

      expect(result.status).toBe("placed");
      expect(result.externalOrderId).toMatch(/^MOCK-/);
      expect(result.placedAt).toBeDefined();
    });

    it("simulates transient failure when configured", async () => {
      provider.configureNextOrderOutcome({
        status: "failed",
        failureKind: "transient",
        failureReason: "rate limited",
      });

      const result = await provider.placeOrder(baseRequest);

      expect(result.status).toBe("failed");
      expect(result.failureKind).toBe("transient");
    });

    it("simulates out-of-stock permanent failure when configured", async () => {
      provider.configureNextOrderOutcome({
        status: "failed",
        failureKind: "out_of_stock",
        failureReason: "stock depleted",
      });

      const result = await provider.placeOrder(baseRequest);

      expect(result.status).toBe("failed");
      expect(result.failureKind).toBe("out_of_stock");
    });
  });

  describe("getTracking", () => {
    it("returns processing status for fresh order", async () => {
      const update = await provider.getTracking("MOCK-FRESH");

      expect(update.status).toBe("processing");
      expect(update.events.length).toBeGreaterThan(0);
    });

    it("returns shipped status when configured", async () => {
      provider.configureTracking("MOCK-SHIP", {
        status: "shipped",
        trackingCode: "BR123456789CN",
      });

      const update = await provider.getTracking("MOCK-SHIP");

      expect(update.status).toBe("shipped");
      expect(update.trackingCode).toBe("BR123456789CN");
    });
  });

  describe("cancelOrder", () => {
    it("cancels unplaced order successfully", async () => {
      const result = await provider.cancelOrder("MOCK-1", "customer request");
      expect(result.success).toBe(true);
    });
  });
});

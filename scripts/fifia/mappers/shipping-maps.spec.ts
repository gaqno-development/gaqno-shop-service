import { zoneToShippingMethod, zoneSlug } from "./shipping-maps";

describe("zoneToShippingMethod", () => {
  it("builds a shipping method from a fifia ShippingZone row", () => {
    const result = zoneToShippingMethod({
      id: "zone-1",
      name: "Centro",
      zipStart: "01000000",
      zipEnd: "01999999",
      fixedPrice: "15.50",
      pricePerKm: "0",
      isActive: true,
    });

    expect(result).toEqual({
      name: "Centro",
      slug: "centro",
      carrier: "local",
      is_active: true,
      flat_rate: "15.50",
      handling_days: 1,
      settings: {
        sourceZoneId: "zone-1",
        zipStart: "01000-000",
        zipEnd: "01999-999",
        pricePerKm: "0.00",
      },
    });
  });

  it("coerces numeric price to fixed 2-decimal string", () => {
    const result = zoneToShippingMethod({
      id: "z2",
      name: "Bairro Alto",
      zipStart: "02000000",
      zipEnd: "02000999",
      fixedPrice: 10,
      pricePerKm: 0,
      isActive: true,
    });
    expect(result.flat_rate).toBe("10.00");
  });

  it("formats zip ranges as CEP with hyphen", () => {
    const result = zoneToShippingMethod({
      id: "z3",
      name: "X",
      zipStart: "01310100",
      zipEnd: "01310199",
      fixedPrice: "5",
      pricePerKm: "0",
      isActive: true,
    });
    expect(result.settings.zipStart).toBe("01310-100");
    expect(result.settings.zipEnd).toBe("01310-199");
  });

  it("generates url-safe slug from name", () => {
    expect(zoneSlug("Centro de São Paulo")).toBe("centro-de-sao-paulo");
    expect(zoneSlug("Região Metropolitana - Zona Sul")).toBe(
      "regiao-metropolitana-zona-sul",
    );
    expect(zoneSlug("  extra   spaces  ")).toBe("extra-spaces");
  });
});

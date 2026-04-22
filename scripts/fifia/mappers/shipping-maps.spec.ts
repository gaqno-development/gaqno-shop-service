import { zoneToShippingMethod } from "./shipping-maps";

describe("zoneToShippingMethod", () => {
  it("builds a delivery method from a ShippingZone row", () => {
    const result = zoneToShippingMethod({
      id: "zone-1",
      name: "Centro",
      description: "Entrega na região central",
      price: "15.50",
      minDeliveryDays: 1,
      maxDeliveryDays: 2,
      ceps: ["01310-100", "01311-000"],
      active: true,
    });

    expect(result).toEqual({
      name: "Centro",
      description: "Entrega na região central",
      type: "delivery",
      price: "15.50",
      minDeliveryDays: 1,
      maxDeliveryDays: 2,
      active: true,
      settings: {
        sourceZoneId: "zone-1",
        ceps: ["01310-100", "01311-000"],
      },
    });
  });

  it("coerces numeric price to fixed 2-decimal string", () => {
    const result = zoneToShippingMethod({
      id: "z2",
      name: "Bairro",
      description: null,
      price: 10,
      minDeliveryDays: null,
      maxDeliveryDays: null,
      ceps: [],
      active: true,
    });
    expect(result.price).toBe("10.00");
  });

  it("defaults description to empty string when null", () => {
    const result = zoneToShippingMethod({
      id: "z3",
      name: "X",
      description: null,
      price: "5",
      minDeliveryDays: 1,
      maxDeliveryDays: 1,
      ceps: [],
      active: true,
    });
    expect(result.description).toBe("");
  });

  it("normalizes CEPs inside settings.ceps", () => {
    const result = zoneToShippingMethod({
      id: "z4",
      name: "Y",
      description: "",
      price: "0",
      minDeliveryDays: 0,
      maxDeliveryDays: 0,
      ceps: ["01310100", "CEP 02000-000", "abc"],
      active: false,
    });
    expect(result.settings.ceps).toEqual(["01310-100", "02000-000"]);
  });
});

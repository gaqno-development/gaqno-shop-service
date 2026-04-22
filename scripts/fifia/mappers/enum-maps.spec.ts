import {
  mapOrderStatus,
  mapPaymentStatus,
  mapPaymentMethod,
  mapDecorationType,
  mapCouponType,
  mapMovementType,
  mapAdminEventType,
  mapRoleToCustomer,
} from "./enum-maps";

describe("fifia enum mappers", () => {
  describe("mapOrderStatus", () => {
    it.each([
      ["AWAITING_PAYMENT", "pending"],
      ["PAID", "confirmed"],
      ["AWAITING_DECORATION_REVIEW", "awaiting_decoration_review"],
      ["DECORATION_APPROVED", "decoration_approved"],
      ["PREPARING", "processing"],
      ["READY", "processing"],
      ["OUT_FOR_DELIVERY", "shipped"],
      ["COMPLETED", "delivered"],
      ["CANCELLED", "cancelled"],
    ])("maps %s -> %s", (input, expected) => {
      expect(mapOrderStatus(input)).toBe(expected);
    });

    it("throws on unknown value to surface source schema drift loudly", () => {
      expect(() => mapOrderStatus("UNKNOWN_STATUS")).toThrow(
        "Unmapped fifia OrderStatus: UNKNOWN_STATUS",
      );
    });
  });

  describe("mapPaymentStatus", () => {
    it.each([
      ["AWAITING_PAYMENT", "pending"],
      ["CONFIRMED", "approved"],
      ["REFUNDED", "refunded"],
    ])("maps %s -> %s", (input, expected) => {
      expect(mapPaymentStatus(input)).toBe(expected);
    });

    it("throws on unknown payment status", () => {
      expect(() => mapPaymentStatus("PARTIAL")).toThrow(
        "Unmapped fifia PaymentStatus: PARTIAL",
      );
    });
  });

  describe("mapPaymentMethod", () => {
    it("maps PIX -> pix", () => {
      expect(mapPaymentMethod("PIX")).toBe("pix");
    });

    it("maps CHECKOUT_PRO -> credit_card (closest target fit)", () => {
      expect(mapPaymentMethod("CHECKOUT_PRO")).toBe("credit_card");
    });

    it("throws on unknown payment method", () => {
      expect(() => mapPaymentMethod("CRYPTO")).toThrow(
        "Unmapped fifia PaymentMethod: CRYPTO",
      );
    });
  });

  describe("mapDecorationType", () => {
    it.each([
      ["TOPPING", "topping"],
      ["FILLING", "filling"],
      ["MESSAGE", "message"],
      ["THEME", "theme"],
      ["EXTRA", "extra"],
    ])("maps %s -> %s", (input, expected) => {
      expect(mapDecorationType(input)).toBe(expected);
    });

    it("throws on legacy ETL values that do not exist in the real schema", () => {
      expect(() => mapDecorationType("TOPPER")).toThrow(
        "Unmapped fifia DecorationType: TOPPER",
      );
      expect(() => mapDecorationType("FLOWER")).toThrow(
        "Unmapped fifia DecorationType: FLOWER",
      );
      expect(() => mapDecorationType("CUSTOM")).toThrow(
        "Unmapped fifia DecorationType: CUSTOM",
      );
    });
  });

  describe("mapCouponType", () => {
    it.each([
      ["PERCENTAGE", "percentage"],
      ["FIXED", "fixed"],
    ])("maps %s -> %s", (input, expected) => {
      expect(mapCouponType(input)).toBe(expected);
    });

    it("throws on unknown coupon type", () => {
      expect(() => mapCouponType("BOGO")).toThrow(
        "Unmapped fifia CouponType: BOGO",
      );
    });
  });

  describe("mapMovementType", () => {
    it.each([
      ["IN", "in"],
      ["OUT", "out"],
      ["ADJUSTMENT", "adjustment"],
    ])("maps %s -> %s", (input, expected) => {
      expect(mapMovementType(input)).toBe(expected);
    });

    it("throws on unknown movement type", () => {
      expect(() => mapMovementType("TRANSFER")).toThrow(
        "Unmapped fifia MovementType: TRANSFER",
      );
    });
  });

  describe("mapAdminEventType", () => {
    it.each([
      ["STOCK_PURCHASE", "stock_purchase"],
      ["PRODUCTION", "production"],
      ["DELIVERY", "delivery"],
      ["CUSTOM", "custom"],
    ])("maps %s -> %s", (input, expected) => {
      expect(mapAdminEventType(input)).toBe(expected);
    });

    it("throws on unknown event type", () => {
      expect(() => mapAdminEventType("MEETING")).toThrow(
        "Unmapped fifia EventType: MEETING",
      );
    });
  });

  describe("mapRoleToCustomer", () => {
    it("returns true for CUSTOMER role (migrate)", () => {
      expect(mapRoleToCustomer("CUSTOMER")).toBe(true);
    });

    it("returns false for ADMIN role (skip, re-invite via SSO)", () => {
      expect(mapRoleToCustomer("ADMIN")).toBe(false);
    });

    it("returns false for any unknown role to be safe-by-default", () => {
      expect(mapRoleToCustomer("OPERATOR")).toBe(false);
      expect(mapRoleToCustomer("")).toBe(false);
    });
  });
});

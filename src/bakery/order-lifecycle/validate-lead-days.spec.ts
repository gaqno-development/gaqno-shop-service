import {
  computeRequiredLeadDays,
  validateLeadDays,
} from "./validate-lead-days";

describe("computeRequiredLeadDays", () => {
  it("returns fallback when no products", () => {
    expect(computeRequiredLeadDays([], 3)).toBe(3);
  });

  it("returns max of product leadDays", () => {
    const products = [
      { id: "a", leadDays: 2 },
      { id: "b", leadDays: 5 },
      { id: "c", leadDays: 3 },
    ];
    expect(computeRequiredLeadDays(products, 1)).toBe(5);
  });

  it("treats null leadDays as fallback", () => {
    const products = [
      { id: "a", leadDays: null },
      { id: "b", leadDays: 2 },
    ];
    expect(computeRequiredLeadDays(products, 4)).toBe(4);
  });
});

describe("validateLeadDays", () => {
  const localDate = (y: number, m: number, d: number): Date =>
    new Date(y, m - 1, d, 12, 0, 0);
  const monday = localDate(2025, 1, 6);

  it("accepts delivery date at exactly earliest acceptable date", () => {
    const result = validateLeadDays({
      now: monday,
      deliveryDate: localDate(2025, 1, 9),
      products: [{ id: "p1", leadDays: 3 }],
      fallbackLeadDays: 3,
    });
    expect(result.valid).toBe(true);
    expect(result.violatingProductIds).toEqual([]);
  });

  it("rejects delivery date before the required lead time", () => {
    const result = validateLeadDays({
      now: monday,
      deliveryDate: localDate(2025, 1, 7),
      products: [{ id: "p1", leadDays: 3 }],
      fallbackLeadDays: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.violatingProductIds).toContain("p1");
    expect(result.requiredLeadDays).toBe(3);
  });

  it("picks the strictest product lead time", () => {
    const result = validateLeadDays({
      now: monday,
      deliveryDate: localDate(2025, 1, 9),
      products: [
        { id: "fast", leadDays: 1 },
        { id: "slow", leadDays: 5 },
      ],
      fallbackLeadDays: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.requiredLeadDays).toBe(5);
    expect(result.violatingProductIds).toEqual(["slow"]);
  });

  it("falls back for products with null leadDays", () => {
    const result = validateLeadDays({
      now: monday,
      deliveryDate: localDate(2025, 1, 7),
      products: [{ id: "p1", leadDays: null }],
      fallbackLeadDays: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.violatingProductIds).toContain("p1");
  });
});

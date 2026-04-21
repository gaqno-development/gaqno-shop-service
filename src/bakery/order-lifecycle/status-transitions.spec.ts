import {
  canTransition,
  isDecorationReviewTransition,
  shouldDeductIngredients,
} from "./status-transitions";

describe("canTransition", () => {
  it("allows pending → confirmed", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
  });

  it("allows confirmed → awaiting_decoration_review", () => {
    expect(canTransition("confirmed", "awaiting_decoration_review")).toBe(true);
  });

  it("allows awaiting_decoration_review → decoration_approved", () => {
    expect(canTransition("awaiting_decoration_review", "decoration_approved")).toBe(
      true,
    );
  });

  it("allows decoration_approved → processing", () => {
    expect(canTransition("decoration_approved", "processing")).toBe(true);
  });

  it("rejects pending → delivered (skipping steps)", () => {
    expect(canTransition("pending", "delivered")).toBe(false);
  });

  it("rejects cancelled → anything", () => {
    expect(canTransition("cancelled", "pending")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("allows idempotent same-status transitions", () => {
    expect(canTransition("confirmed", "confirmed")).toBe(true);
  });
});

describe("shouldDeductIngredients", () => {
  it("returns true moving from pending → confirmed", () => {
    expect(shouldDeductIngredients("pending", "confirmed")).toBe(true);
  });

  it("returns false when already confirmed", () => {
    expect(shouldDeductIngredients("confirmed", "confirmed")).toBe(false);
  });

  it("returns false moving forward past confirmed", () => {
    expect(shouldDeductIngredients("confirmed", "processing")).toBe(false);
  });

  it("returns false for non-confirmation targets", () => {
    expect(shouldDeductIngredients("pending", "cancelled")).toBe(false);
  });
});

describe("isDecorationReviewTransition", () => {
  it("detects both decoration states", () => {
    expect(isDecorationReviewTransition("awaiting_decoration_review")).toBe(true);
    expect(isDecorationReviewTransition("decoration_approved")).toBe(true);
  });

  it("ignores unrelated states", () => {
    expect(isDecorationReviewTransition("processing")).toBe(false);
  });
});

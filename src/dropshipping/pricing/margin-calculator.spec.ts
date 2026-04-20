import {
  applyMargin,
  calculateFinalPrice,
  convertUsdToBrl,
  roundPsychological,
} from "./margin-calculator";

describe("margin-calculator", () => {
  describe("convertUsdToBrl", () => {
    it("multiplies USD by rate and rounds to cents", () => {
      expect(convertUsdToBrl(10, 5.25)).toBe(52.5);
      expect(convertUsdToBrl(3.33, 5.1)).toBe(16.98);
    });

    it("throws when rate is non-positive", () => {
      expect(() => convertUsdToBrl(10, 0)).toThrow(/positive/i);
      expect(() => convertUsdToBrl(10, -1)).toThrow(/positive/i);
    });

    it("throws when USD amount is negative", () => {
      expect(() => convertUsdToBrl(-1, 5)).toThrow(/negative/i);
    });
  });

  describe("applyMargin", () => {
    it("applies positive margin percent", () => {
      expect(applyMargin(100, 80)).toBe(180);
      expect(applyMargin(50, 20)).toBe(60);
    });

    it("returns same value when margin is 0", () => {
      expect(applyMargin(100, 0)).toBe(100);
    });

    it("throws when margin is negative", () => {
      expect(() => applyMargin(100, -1)).toThrow(/margin/i);
    });
  });

  describe("roundPsychological", () => {
    it("rounds to nearest .90 below the input", () => {
      expect(roundPsychological(17.42, "ninety")).toBe(16.9);
      expect(roundPsychological(50.0, "ninety")).toBe(49.9);
      expect(roundPsychological(100.5, "ninety")).toBe(99.9);
    });

    it("rounds to nearest .99 below the input", () => {
      expect(roundPsychological(17.42, "ninety_nine")).toBe(16.99);
      expect(roundPsychological(50.0, "ninety_nine")).toBe(49.99);
    });

    it("returns the same value when strategy is none", () => {
      expect(roundPsychological(17.42, "none")).toBe(17.42);
    });
  });

  describe("calculateFinalPrice", () => {
    it("combines conversion, margin and rounding", () => {
      const result = calculateFinalPrice({
        costUsd: 10,
        fxRate: 5.25,
        marginPercent: 80,
        rounding: "ninety",
      });

      expect(result.costBrl).toBe(52.5);
      expect(result.finalPriceBrl).toBe(93.9);
      expect(result.marginPercent).toBe(80);
    });

    it("uses override margin when provided", () => {
      const result = calculateFinalPrice({
        costUsd: 10,
        fxRate: 5,
        marginPercent: 80,
        overrideMarginPercent: 50,
        rounding: "none",
      });

      expect(result.finalPriceBrl).toBe(75);
      expect(result.marginPercent).toBe(50);
    });

    it("returns cost=final when margin is 0", () => {
      const result = calculateFinalPrice({
        costUsd: 10,
        fxRate: 5,
        marginPercent: 0,
        rounding: "none",
      });

      expect(result.costBrl).toBe(50);
      expect(result.finalPriceBrl).toBe(50);
    });
  });
});

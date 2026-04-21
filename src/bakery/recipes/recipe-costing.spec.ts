import { computeRecipeCost } from "./recipe-costing";

describe("computeRecipeCost", () => {
  it("computes ingredients cost from quantity × cost per unit", () => {
    const result = computeRecipeCost({
      laborCost: "0",
      overheadCost: "0",
      profitMarginPercent: "0",
      yieldQuantity: "1",
      ingredients: [
        { quantity: "0.5", costPerUnit: "10" },
        { quantity: "2", costPerUnit: "3" },
      ],
    });
    expect(result.ingredientsCost).toBe(11);
    expect(result.totalCost).toBe(11);
  });

  it("adds labor and overhead to total cost", () => {
    const result = computeRecipeCost({
      laborCost: "20",
      overheadCost: "5",
      profitMarginPercent: "0",
      yieldQuantity: "1",
      ingredients: [{ quantity: "1", costPerUnit: "10" }],
    });
    expect(result.totalCost).toBe(35);
  });

  it("divides total cost by yield quantity", () => {
    const result = computeRecipeCost({
      laborCost: "10",
      overheadCost: "0",
      profitMarginPercent: "0",
      yieldQuantity: "5",
      ingredients: [{ quantity: "1", costPerUnit: "40" }],
    });
    expect(result.costPerYieldUnit).toBe(10);
  });

  it("applies profit margin to suggested price", () => {
    const result = computeRecipeCost({
      laborCost: "0",
      overheadCost: "0",
      profitMarginPercent: "50",
      yieldQuantity: "1",
      ingredients: [{ quantity: "1", costPerUnit: "10" }],
    });
    expect(result.suggestedPrice).toBe(15);
  });

  it("clamps yield to at least 1 to avoid division by zero", () => {
    const result = computeRecipeCost({
      laborCost: "0",
      overheadCost: "0",
      profitMarginPercent: "0",
      yieldQuantity: "0",
      ingredients: [{ quantity: "1", costPerUnit: "12" }],
    });
    expect(result.costPerYieldUnit).toBe(12);
  });

  it("tolerates non-numeric strings (treats as 0)", () => {
    const result = computeRecipeCost({
      laborCost: "abc",
      overheadCost: "",
      profitMarginPercent: "x",
      yieldQuantity: "1",
      ingredients: [{ quantity: "1", costPerUnit: "5" }],
    });
    expect(result.totalCost).toBe(5);
    expect(result.suggestedPrice).toBe(5);
  });

  it("rounds all monetary values to 2 decimals", () => {
    const result = computeRecipeCost({
      laborCost: "1",
      overheadCost: "0",
      profitMarginPercent: "33.333",
      yieldQuantity: "3",
      ingredients: [{ quantity: "1", costPerUnit: "10" }],
    });
    expect(result.totalCost).toBe(11);
    expect(result.costPerYieldUnit).toBe(3.67);
    expect(result.suggestedPrice).toBe(4.89);
  });
});

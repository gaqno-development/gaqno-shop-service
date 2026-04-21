import {
  mergeDeductionPlans,
  planDirectDeduction,
  planRecipeDeduction,
} from "./plan-ingredient-deduction";

describe("planRecipeDeduction", () => {
  it("returns empty for no items", () => {
    expect(planRecipeDeduction([])).toEqual([]);
  });

  it("scales ingredients by batches needed", () => {
    const plan = planRecipeDeduction([
      {
        productId: "cake",
        quantity: 4,
        recipeYield: 2,
        ingredients: [
          { ingredientId: "flour", quantityPerRecipeYield: 500 },
          { ingredientId: "sugar", quantityPerRecipeYield: 200 },
        ],
      },
    ]);
    expect(plan).toEqual([
      { ingredientId: "flour", quantity: 1000 },
      { ingredientId: "sugar", quantity: 400 },
    ]);
  });

  it("sums same ingredient across multiple items", () => {
    const plan = planRecipeDeduction([
      {
        productId: "a",
        quantity: 1,
        recipeYield: 1,
        ingredients: [{ ingredientId: "flour", quantityPerRecipeYield: 100 }],
      },
      {
        productId: "b",
        quantity: 1,
        recipeYield: 1,
        ingredients: [{ ingredientId: "flour", quantityPerRecipeYield: 50 }],
      },
    ]);
    expect(plan).toEqual([{ ingredientId: "flour", quantity: 150 }]);
  });

  it("ignores items with zero or negative yield", () => {
    const plan = planRecipeDeduction([
      {
        productId: "a",
        quantity: 2,
        recipeYield: 0,
        ingredients: [{ ingredientId: "flour", quantityPerRecipeYield: 100 }],
      },
    ]);
    expect(plan).toEqual([]);
  });
});

describe("planDirectDeduction", () => {
  it("multiplies direct ingredient quantity by order quantity", () => {
    const plan = planDirectDeduction([
      {
        productId: "pack",
        quantity: 3,
        ingredients: [{ ingredientId: "wrap", quantityPerRecipeYield: 2 }],
      },
    ]);
    expect(plan).toEqual([{ ingredientId: "wrap", quantity: 6 }]);
  });
});

describe("mergeDeductionPlans", () => {
  it("adds quantities across plans", () => {
    const merged = mergeDeductionPlans(
      [{ ingredientId: "x", quantity: 1.5 }],
      [
        { ingredientId: "x", quantity: 2.25 },
        { ingredientId: "y", quantity: 0.1 },
      ],
    );
    expect(merged).toEqual([
      { ingredientId: "x", quantity: 3.75 },
      { ingredientId: "y", quantity: 0.1 },
    ]);
  });
});

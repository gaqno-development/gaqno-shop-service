import {
  mergeDeductionPlans,
  planDirectDeduction,
  planBatchDeduction,
} from "../../shared/material-deduction";

describe("planBatchDeduction", () => {
  it("returns empty for no items", () => {
    expect(planBatchDeduction([])).toEqual([]);
  });

  it("scales materials by batches needed", () => {
    const plan = planBatchDeduction([
      {
        productId: "product1",
        quantity: 4,
        batchYield: 2,
        materials: [
          { materialId: "mat1", quantityPerBatch: 500 },
          { materialId: "mat2", quantityPerBatch: 200 },
        ],
      },
    ]);
    expect(plan).toEqual([
      { materialId: "mat1", quantity: 1000 },
      { materialId: "mat2", quantity: 400 },
    ]);
  });

  it("sums same material across multiple items", () => {
    const plan = planBatchDeduction([
      {
        productId: "a",
        quantity: 1,
        batchYield: 1,
        materials: [{ materialId: "mat1", quantityPerBatch: 100 }],
      },
      {
        productId: "b",
        quantity: 1,
        batchYield: 1,
        materials: [{ materialId: "mat1", quantityPerBatch: 50 }],
      },
    ]);
    expect(plan).toEqual([{ materialId: "mat1", quantity: 150 }]);
  });

  it("ignores items with zero or negative yield", () => {
    const plan = planBatchDeduction([
      {
        productId: "a",
        quantity: 2,
        batchYield: 0,
        materials: [{ materialId: "mat1", quantityPerBatch: 100 }],
      },
    ]);
    expect(plan).toEqual([]);
  });
});

describe("planDirectDeduction", () => {
  it("multiplies direct material quantity by order quantity", () => {
    const plan = planDirectDeduction([
      {
        productId: "pack",
        quantity: 3,
        materials: [{ materialId: "wrap", quantityPerBatch: 2 }],
      },
    ]);
    expect(plan).toEqual([{ materialId: "wrap", quantity: 6 }]);
  });
});

describe("mergeDeductionPlans", () => {
  it("adds quantities across plans", () => {
    const merged = mergeDeductionPlans(
      [{ materialId: "x", quantity: 1.5 }],
      [
        { materialId: "x", quantity: 2.25 },
        { materialId: "y", quantity: 0.1 },
      ],
    );
    expect(merged).toEqual([
      { materialId: "x", quantity: 3.75 },
      { materialId: "y", quantity: 0.1 },
    ]);
  });
});

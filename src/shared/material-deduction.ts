export interface MaterialUsage {
  readonly materialId: string;
  readonly quantityPerBatch: number;
}

export interface BatchDeduction {
  readonly productId: string;
  readonly quantity: number;
  readonly batchYield: number;
  readonly materials: readonly MaterialUsage[];
}

export interface DirectDeduction {
  readonly productId: string;
  readonly quantity: number;
  readonly materials: readonly MaterialUsage[];
}

export interface DeductionPlanItem {
  readonly materialId: string;
  readonly quantity: number;
}

export function planBatchDeduction(
  items: readonly BatchDeduction[],
): readonly DeductionPlanItem[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.batchYield <= 0) continue;
    const batches = item.quantity / item.batchYield;
    for (const mat of item.materials) {
      const add = mat.quantityPerBatch * batches;
      totals.set(mat.materialId, (totals.get(mat.materialId) ?? 0) + add);
    }
  }
  return Array.from(totals.entries()).map(([materialId, quantity]) => ({
    materialId,
    quantity: round3(quantity),
  }));
}

export function planDirectDeduction(
  items: readonly DirectDeduction[],
): readonly DeductionPlanItem[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    for (const mat of item.materials) {
      const add = mat.quantityPerBatch * item.quantity;
      totals.set(mat.materialId, (totals.get(mat.materialId) ?? 0) + add);
    }
  }
  return Array.from(totals.entries()).map(([materialId, quantity]) => ({
    materialId,
    quantity: round3(quantity),
  }));
}

export function mergeDeductionPlans(
  ...plans: readonly (readonly DeductionPlanItem[])[]
): readonly DeductionPlanItem[] {
  const totals = new Map<string, number>();
  for (const plan of plans) {
    for (const entry of plan) {
      totals.set(
        entry.materialId,
        (totals.get(entry.materialId) ?? 0) + entry.quantity,
      );
    }
  }
  return Array.from(totals.entries()).map(([materialId, quantity]) => ({
    materialId,
    quantity: round3(quantity),
  }));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

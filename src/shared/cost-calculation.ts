export interface CostInput {
  readonly laborCost: string | number;
  readonly overheadCost: string | number;
  readonly profitMarginPercent: string | number;
  readonly yieldQuantity: string | number;
  readonly materials: ReadonlyArray<{
    readonly quantity: string | number;
    readonly costPerUnit: string | number;
  }>;
}

export interface CostBreakdown {
  readonly materialsCost: number;
  readonly laborCost: number;
  readonly overheadCost: number;
  readonly totalCost: number;
  readonly costPerYieldUnit: number;
  readonly suggestedPrice: number;
  readonly profitMarginPercent: number;
}

const TWO_DECIMALS = 100;

function toNumber(v: string | number): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * TWO_DECIMALS) / TWO_DECIMALS;
}

export function computeCost(input: CostInput): CostBreakdown {
  const materialsCost = input.materials.reduce(
    (sum, i) => sum + toNumber(i.quantity) * toNumber(i.costPerUnit),
    0,
  );
  const laborCost = toNumber(input.laborCost);
  const overheadCost = toNumber(input.overheadCost);
  const totalCost = materialsCost + laborCost + overheadCost;
  const yieldQty = Math.max(toNumber(input.yieldQuantity), 1);
  const marginPercent = toNumber(input.profitMarginPercent);
  const costPerYieldUnit = totalCost / yieldQty;
  const suggestedPrice = costPerYieldUnit * (1 + marginPercent / 100);

  return {
    materialsCost: round2(materialsCost),
    laborCost: round2(laborCost),
    overheadCost: round2(overheadCost),
    totalCost: round2(totalCost),
    costPerYieldUnit: round2(costPerYieldUnit),
    suggestedPrice: round2(suggestedPrice),
    profitMarginPercent: round2(marginPercent),
  };
}

export interface RecipeIngredientUsage {
  readonly ingredientId: string;
  readonly quantityPerRecipeYield: number;
}

export interface ProductRecipeDeduction {
  readonly productId: string;
  readonly quantity: number;
  readonly recipeYield: number;
  readonly ingredients: readonly RecipeIngredientUsage[];
}

export interface ProductDirectIngredient {
  readonly productId: string;
  readonly quantity: number;
  readonly ingredients: readonly RecipeIngredientUsage[];
}

export interface DeductionPlanItem {
  readonly ingredientId: string;
  readonly quantity: number;
}

export function planRecipeDeduction(
  items: readonly ProductRecipeDeduction[],
): readonly DeductionPlanItem[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.recipeYield <= 0) continue;
    const batches = item.quantity / item.recipeYield;
    for (const ing of item.ingredients) {
      const add = ing.quantityPerRecipeYield * batches;
      totals.set(ing.ingredientId, (totals.get(ing.ingredientId) ?? 0) + add);
    }
  }
  return Array.from(totals.entries()).map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity: round3(quantity),
  }));
}

export function planDirectDeduction(
  items: readonly ProductDirectIngredient[],
): readonly DeductionPlanItem[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    for (const ing of item.ingredients) {
      const add = ing.quantityPerRecipeYield * item.quantity;
      totals.set(ing.ingredientId, (totals.get(ing.ingredientId) ?? 0) + add);
    }
  }
  return Array.from(totals.entries()).map(([ingredientId, quantity]) => ({
    ingredientId,
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
        entry.ingredientId,
        (totals.get(entry.ingredientId) ?? 0) + entry.quantity,
      );
    }
  }
  return Array.from(totals.entries()).map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity: round3(quantity),
  }));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

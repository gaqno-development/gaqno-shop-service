export type BakeryOrderStatus =
  | "pending"
  | "confirmed"
  | "awaiting_decoration_review"
  | "decoration_approved"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const ALLOWED_TRANSITIONS: Record<BakeryOrderStatus, readonly BakeryOrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: [
    "awaiting_decoration_review",
    "processing",
    "cancelled",
    "refunded",
  ],
  awaiting_decoration_review: ["decoration_approved", "cancelled", "refunded"],
  decoration_approved: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const INGREDIENT_DEDUCTION_TARGETS: readonly BakeryOrderStatus[] = [
  "confirmed",
];

export function canTransition(
  from: BakeryOrderStatus,
  to: BakeryOrderStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function shouldDeductIngredients(
  previous: BakeryOrderStatus,
  next: BakeryOrderStatus,
): boolean {
  if (previous === next) return false;
  return (
    INGREDIENT_DEDUCTION_TARGETS.includes(next) &&
    !INGREDIENT_DEDUCTION_TARGETS.includes(previous)
  );
}

export function isDecorationReviewTransition(
  next: BakeryOrderStatus,
): boolean {
  return (
    next === "awaiting_decoration_review" || next === "decoration_approved"
  );
}

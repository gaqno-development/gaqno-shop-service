import { addBusinessDays, isBeforeDate } from "./business-days";

export interface LeadDayProduct {
  readonly id: string;
  readonly leadDays: number | null;
}

export interface LeadDayValidationInput {
  readonly now: Date;
  readonly deliveryDate: Date;
  readonly products: readonly LeadDayProduct[];
  readonly fallbackLeadDays: number;
}

export interface LeadDayValidationResult {
  readonly valid: boolean;
  readonly requiredLeadDays: number;
  readonly earliestDeliveryDate: Date;
  readonly violatingProductIds: readonly string[];
}

export function computeRequiredLeadDays(
  products: readonly LeadDayProduct[],
  fallback: number,
): number {
  const effective = products.map((p) =>
    typeof p.leadDays === "number" && p.leadDays >= 0 ? p.leadDays : fallback,
  );
  if (effective.length === 0) {
    return fallback;
  }
  return Math.max(...effective);
}

export function validateLeadDays(
  input: LeadDayValidationInput,
): LeadDayValidationResult {
  const required = computeRequiredLeadDays(
    input.products,
    input.fallbackLeadDays,
  );
  const earliest = addBusinessDays(startOfDay(input.now), required);
  const target = startOfDay(input.deliveryDate);
  const valid = !isBeforeDate(target, earliest);

  const violating = valid
    ? []
    : input.products
        .filter((p) => {
          const needed =
            typeof p.leadDays === "number" && p.leadDays >= 0
              ? p.leadDays
              : input.fallbackLeadDays;
          const productEarliest = addBusinessDays(
            startOfDay(input.now),
            needed,
          );
          return isBeforeDate(target, productEarliest);
        })
        .map((p) => p.id);

  return {
    valid,
    requiredLeadDays: required,
    earliestDeliveryDate: earliest,
    violatingProductIds: violating,
  };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

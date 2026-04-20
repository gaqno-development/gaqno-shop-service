export type PsychologicalRounding = "none" | "ninety" | "ninety_nine";

export interface PriceCalculationInput {
  readonly costUsd: number;
  readonly fxRate: number;
  readonly marginPercent: number;
  readonly overrideMarginPercent?: number;
  readonly rounding: PsychologicalRounding;
}

export interface PriceCalculationResult {
  readonly costBrl: number;
  readonly finalPriceBrl: number;
  readonly marginPercent: number;
}

export function convertUsdToBrl(amountUsd: number, fxRate: number): number {
  if (fxRate <= 0) throw new Error("fxRate must be positive");
  if (amountUsd < 0) throw new Error("amountUsd must not be negative");
  return roundCents(amountUsd * fxRate);
}

export function applyMargin(amount: number, marginPercent: number): number {
  if (marginPercent < 0) throw new Error("margin must not be negative");
  return roundCents(amount * (1 + marginPercent / 100));
}

const ROUNDING_STRATEGIES: Readonly<
  Record<PsychologicalRounding, (value: number) => number>
> = {
  none: (value) => roundCents(value),
  ninety: (value) => roundToEnding(value, 0.9),
  ninety_nine: (value) => roundToEnding(value, 0.99),
};

export function roundPsychological(
  value: number,
  strategy: PsychologicalRounding,
): number {
  return ROUNDING_STRATEGIES[strategy](value);
}

export function calculateFinalPrice(
  input: PriceCalculationInput,
): PriceCalculationResult {
  const costBrl = convertUsdToBrl(input.costUsd, input.fxRate);
  const marginPercent = input.overrideMarginPercent ?? input.marginPercent;
  const withMargin = applyMargin(costBrl, marginPercent);
  const finalPriceBrl = roundPsychological(withMargin, input.rounding);
  return { costBrl, finalPriceBrl, marginPercent };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToEnding(value: number, ending: number): number {
  const floor = Math.floor(value);
  const candidate = floor + ending;
  return candidate <= value ? candidate : floor - 1 + ending;
}

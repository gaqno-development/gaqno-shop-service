import { customers } from "../database/schema";

export type CustomerRow = typeof customers.$inferSelect;

export type SanitizedCustomer = Omit<CustomerRow, "password">;

export function sanitizeCustomer(customer: CustomerRow): SanitizedCustomer {
  const { password: _password, ...sanitized } = customer;
  return sanitized;
}

const DURATION_PATTERN = /(\d+)([dhm])/;
const DURATION_MULTIPLIERS: Record<"d" | "h" | "m", number> = {
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
};
const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isDurationUnit(value: string): value is "d" | "h" | "m" {
  return value === "d" || value === "h" || value === "m";
}

export function parseDurationToMs(duration: string): number {
  const match = duration.match(DURATION_PATTERN);
  if (!match) return DEFAULT_DURATION_MS;
  const [, rawValue, rawUnit] = match;
  if (!rawValue || !rawUnit || !isDurationUnit(rawUnit)) {
    return DEFAULT_DURATION_MS;
  }
  const value = parseInt(rawValue, 10);
  return value * DURATION_MULTIPLIERS[rawUnit];
}

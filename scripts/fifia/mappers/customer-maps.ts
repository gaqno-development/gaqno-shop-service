export interface SplitNameResult {
  firstName: string | null;
  lastName: string | null;
}

export function splitName(fullName: string | null): SplitNameResult {
  if (fullName === null) {
    return { firstName: null, lastName: null };
  }
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return { firstName: null, lastName: null };
  }
  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" ") };
}

export function normalizeCep(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const truncated = digits.slice(0, 8);
  const padded = truncated.padStart(8, "0");
  return `${padded.slice(0, 5)}-${padded.slice(5)}`;
}

export function normalizeUf(value: string | null | undefined): string {
  if (!value) return "";
  return value.toUpperCase().slice(0, 2);
}

export function fifiaOrderNumber(sourceId: string): string {
  if (!sourceId || sourceId.length === 0) {
    throw new Error("Cannot build order number from empty source id");
  }
  const suffix = sourceId.slice(-8).toUpperCase().padStart(8, "0");
  return `FIFIA-${suffix}`;
}

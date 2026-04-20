import { createHmac } from "node:crypto";

export type SignablePrimitive = string | number | boolean | null | undefined;

export type SignableParams = Record<string, SignablePrimitive>;

export type NormalizedParams = Record<string, string>;

export interface SignRequestInput {
  readonly apiPath: string;
  readonly params: SignableParams;
  readonly appSecret: string;
}

export function normalizeParams(params: SignableParams): NormalizedParams {
  const entries = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean | null] => {
      return entry[1] !== undefined;
    })
    .map(([key, value]) => [key, value === null ? "" : String(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const normalized: NormalizedParams = {};
  entries.forEach(([key, value]) => {
    normalized[key] = value;
  });
  return normalized;
}

export function buildSignBase(
  apiPath: string,
  params: SignableParams,
): string {
  const normalized = normalizeParams(params);
  const concatenated = Object.entries(normalized)
    .map(([key, value]) => `${key}${value}`)
    .join("");
  return `${apiPath}${concatenated}`;
}

export function signRequest(input: SignRequestInput): string {
  const base = buildSignBase(input.apiPath, input.params);
  return createHmac("sha256", input.appSecret)
    .update(base, "utf8")
    .digest("hex")
    .toUpperCase();
}

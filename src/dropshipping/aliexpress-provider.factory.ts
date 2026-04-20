import { AliExpressClient } from "./providers/aliexpress/aliexpress-client";
import { AliExpressProvider } from "./providers/aliexpress/aliexpress.provider";
import type { AliExpressConfig } from "./providers/aliexpress/aliexpress.types";
import type { MockSupplierProvider } from "./providers/mock/mock-supplier.provider";
import type { SupplierProviderPort } from "./providers/ports/supplier-provider.port";

const DEFAULT_BASE_URL = "https://api.alibaba.com";
const DEFAULT_TIMEOUT_MS = 10000;

export type AliExpressEnv = Readonly<Record<string, string | undefined>>;

export function resolveAliExpressProvider(
  env: AliExpressEnv,
  mock: MockSupplierProvider,
): SupplierProviderPort {
  const appKey = env.ALIEXPRESS_APP_KEY?.trim();
  const appSecret = env.ALIEXPRESS_APP_SECRET?.trim();
  if (!appKey || !appSecret) return mock;

  const config: AliExpressConfig = {
    appKey,
    appSecret,
    baseUrl: env.ALIEXPRESS_BASE_URL?.trim() || DEFAULT_BASE_URL,
    requestTimeoutMs: parsePositiveInt(
      env.ALIEXPRESS_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
  };
  return new AliExpressProvider(new AliExpressClient(config));
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

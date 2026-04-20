import { resolveAliExpressProvider } from "./aliexpress-provider.factory";
import { AliExpressProvider } from "./providers/aliexpress/aliexpress.provider";
import { MockSupplierProvider } from "./providers/mock/mock-supplier.provider";

const VALID_ENV = {
  ALIEXPRESS_APP_KEY: "APP",
  ALIEXPRESS_APP_SECRET: "SECRET",
  ALIEXPRESS_BASE_URL: "https://api.mock-ali.test",
  ALIEXPRESS_TIMEOUT_MS: "5000",
};

describe("resolveAliExpressProvider", () => {
  const mock = new MockSupplierProvider();

  it("returns AliExpressProvider when all required env vars are set", () => {
    const provider = resolveAliExpressProvider(VALID_ENV, mock);
    expect(provider).toBeInstanceOf(AliExpressProvider);
    expect(provider.code).toBe("aliexpress");
  });

  it("falls back to mock when app key is missing", () => {
    const provider = resolveAliExpressProvider(
      { ...VALID_ENV, ALIEXPRESS_APP_KEY: "" },
      mock,
    );
    expect(provider).toBe(mock);
  });

  it("falls back to mock when app secret is missing", () => {
    const provider = resolveAliExpressProvider(
      { ...VALID_ENV, ALIEXPRESS_APP_SECRET: undefined },
      mock,
    );
    expect(provider).toBe(mock);
  });

  it("uses default base url when ALIEXPRESS_BASE_URL is empty", () => {
    const provider = resolveAliExpressProvider(
      { ...VALID_ENV, ALIEXPRESS_BASE_URL: "" },
      mock,
    );
    expect(provider).toBeInstanceOf(AliExpressProvider);
  });
});

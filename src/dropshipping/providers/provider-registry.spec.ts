import { ProviderRegistry } from "./provider-registry";
import { MockSupplierProvider } from "./mock/mock-supplier.provider";
import type { SupplierProviderPort } from "./ports/supplier-provider.port";

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;
  let mock: MockSupplierProvider;

  beforeEach(() => {
    mock = new MockSupplierProvider();
    registry = new ProviderRegistry([mock]);
  });

  it("returns provider by code", () => {
    const provider = registry.get("aliexpress");
    expect(provider).toBe(mock);
  });

  it("throws when code is unknown", () => {
    expect(() => registry.get("unknown" as never)).toThrow(/unknown/i);
  });

  it("lists available codes", () => {
    expect(registry.availableCodes()).toEqual(["aliexpress"]);
  });

  it("fails when constructed with duplicate codes", () => {
    const other: SupplierProviderPort = new MockSupplierProvider();
    expect(() => new ProviderRegistry([mock, other])).toThrow(/duplicate/i);
  });
});

import type { SupplierProductDetail } from "@gaqno-development/types";
import { DropshippingImportService } from "./dropshipping-import.service";
import type {
  DropshippingTenantConfigPort,
  ImportedProductRecord,
  ImportedProductRepositoryPort,
} from "./dropshipping-import.types";
import { MockSupplierProvider } from "./providers/mock/mock-supplier.provider";
import { ProviderRegistry } from "./providers/provider-registry";
import { FxRateService } from "./pricing/fx-rate.service";
import { MockFxRateFetcher } from "./pricing/mock-fx-rate-fetcher";
import type {
  FxRateRepositoryPort,
  FxRateRow,
} from "./pricing/fx-rate.types";

function createFxRepo(): FxRateRepositoryPort {
  const rows: FxRateRow[] = [];
  return {
    async findByDate(date, from, to) {
      return rows.find(
        (r) =>
          r.rateDate === date &&
          r.currencyFrom === from &&
          r.currencyTo === to,
      );
    },
    async findMostRecent(from, to) {
      return rows.find(
        (r) => r.currencyFrom === from && r.currencyTo === to,
      );
    },
    async upsert(row) {
      rows.push(row);
    },
  };
}

function createProductRepo(): ImportedProductRepositoryPort & {
  rows: ImportedProductRecord[];
} {
  const rows: ImportedProductRecord[] = [];
  return {
    rows,
    async findBySource(tenantId, providerCode, externalId) {
      return rows.find(
        (r) =>
          r.tenantId === tenantId &&
          r.sourceProvider === providerCode &&
          r.sourceProductId === externalId,
      );
    },
    async insert(input) {
      const record: ImportedProductRecord = {
        id: `prod-${rows.length + 1}`,
        tenantId: input.tenantId,
        slug: input.slug,
        name: input.name,
        priceBrl: input.priceBrl,
        costBrl: input.costBrl,
        sourceProvider: input.sourceProvider,
        sourceProductId: input.sourceProductId,
      };
      rows.push(record);
      return record;
    },
  };
}

const TENANT_ID = "tenant-1";

const CONFIG_PORT: DropshippingTenantConfigPort = {
  async getConfig() {
    return {
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      defaultMarginPercent: 80,
      rounding: "ninety",
    };
  },
};

describe("DropshippingImportService", () => {
  const clock = () => new Date("2026-04-20T12:00:00Z");
  let mockProvider: MockSupplierProvider;
  let registry: ProviderRegistry;
  let fxService: FxRateService;
  let productRepo: ReturnType<typeof createProductRepo>;
  let service: DropshippingImportService;

  beforeEach(() => {
    mockProvider = new MockSupplierProvider();
    registry = new ProviderRegistry([mockProvider]);
    const fxFetcher = new MockFxRateFetcher();
    fxFetcher.setNext({ rate: 5.25, source: "mock" });
    fxService = new FxRateService(createFxRepo(), fxFetcher, clock);
    productRepo = createProductRepo();
    service = new DropshippingImportService(
      registry,
      fxService,
      CONFIG_PORT,
      productRepo,
    );
  });

  it("imports a new product applying tenant default margin and rounding", async () => {
    const result = await service.importProduct({
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      externalId: "mock-1",
      makeActive: true,
    });

    expect(result.sourceProvider).toBe("aliexpress");
    expect(result.sourceProductId).toBe("mock-1");
    expect(result.priceBrl).toBeGreaterThan(result.costBrl);
    expect(productRepo.rows).toHaveLength(1);
    expect(productRepo.rows[0].slug).toMatch(/mock-1$/);
  });

  it("rejects import when product already exists for tenant", async () => {
    await service.importProduct({
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      externalId: "mock-1",
      makeActive: true,
    });

    await expect(
      service.importProduct({
        tenantId: TENANT_ID,
        providerCode: "aliexpress",
        externalId: "mock-1",
        makeActive: true,
      }),
    ).rejects.toThrow(/already imported/i);
  });

  it("applies override margin when provided", async () => {
    const configPort: DropshippingTenantConfigPort = {
      async getConfig() {
        return {
          tenantId: TENANT_ID,
          providerCode: "aliexpress",
          defaultMarginPercent: 80,
          rounding: "none",
        };
      },
    };
    const repoA = createProductRepo();
    const serviceA = new DropshippingImportService(
      registry,
      fxService,
      configPort,
      repoA,
    );
    const repoB = createProductRepo();
    const serviceB = new DropshippingImportService(
      registry,
      fxService,
      configPort,
      repoB,
    );

    const withDefault = await serviceA.importProduct({
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      externalId: "mock-1",
      makeActive: true,
    });
    const withOverride = await serviceB.importProduct({
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      externalId: "mock-1",
      makeActive: true,
      overrideMarginPercent: 20,
    });

    expect(withOverride.priceBrl).toBeLessThan(withDefault.priceBrl);
  });

  it("rejects unknown provider codes", async () => {
    await expect(
      service.importProduct({
        tenantId: TENANT_ID,
        providerCode: "shopee" as never,
        externalId: "x",
        makeActive: true,
      }),
    ).rejects.toThrow(/unknown provider/i);
  });
});

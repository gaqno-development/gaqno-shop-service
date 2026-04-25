import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TenantService } from "./tenant.service";
import { AI_SERVICE_HTTP_CLIENT } from "./ai-service-client";

function makeDb(overrides: {
  activeTenants: Array<{
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
  }>;
  orderRows: Array<{
    tenantId: string;
    ordersCount30d: string | number;
    revenue30d: string | number | null;
  }>;
  customerRows: Array<{ tenantId: string; customersCount: string | number }>;
}) {
  const selectResults = [overrides.orderRows, overrides.customerRows];
  let selectCallCount = 0;

  const db: any = {
    query: {
      tenants: {
        findMany: jest.fn().mockResolvedValue(overrides.activeTenants),
      },
    },
    select: jest.fn().mockImplementation(() => {
      const rows = selectResults[selectCallCount] ?? [];
      selectCallCount += 1;
      const builder: any = {};
      builder.from = jest.fn().mockReturnValue(builder);
      builder.where = jest.fn().mockReturnValue(builder);
      builder.groupBy = jest.fn().mockReturnValue(builder);
      builder.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve);
      return builder;
    }),
  };
  return db;
}

describe("TenantService.listActiveWithSummary", () => {
  let service: TenantService;

  async function buildService(args: Parameters<typeof makeDb>[0]) {
    const db = makeDb(args);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: "DATABASE", useValue: db },
        { provide: AI_SERVICE_HTTP_CLIENT, useValue: { post: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  it("returns one row per active tenant", async () => {
    await buildService({
      activeTenants: [
        { id: "t1", name: "Fifia Doces", slug: "fifia", logoUrl: "logo.png" },
        { id: "t2", name: "Other", slug: "other", logoUrl: null },
      ],
      orderRows: [
        { tenantId: "t1", ordersCount30d: "12", revenue30d: "1234.56" },
      ],
      customerRows: [{ tenantId: "t1", customersCount: "7" }],
    });

    const result = await service.listActiveWithSummary();

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(["t1", "t2"]);
    expect(result.map((r) => r.ssoTenantId).sort()).toEqual(["t1", "t2"]);
    expect(result.map((r) => r.localTenantId).sort()).toEqual(["t1", "t2"]);
  });

  it("merges order and customer aggregates by tenantId", async () => {
    await buildService({
      activeTenants: [
        { id: "t1", name: "Fifia Doces", slug: "fifia", logoUrl: "logo.png" },
      ],
      orderRows: [
        { tenantId: "t1", ordersCount30d: "12", revenue30d: "1234.56" },
      ],
      customerRows: [{ tenantId: "t1", customersCount: "7" }],
    });

    const [t1] = await service.listActiveWithSummary();
    expect(t1.ordersCount30d).toBe(12);
    expect(t1.revenue30d).toBeCloseTo(1234.56, 2);
    expect(t1.customersCount).toBe(7);
  });

  it("returns zero metrics for tenants with no orders/customers", async () => {
    await buildService({
      activeTenants: [{ id: "t2", name: "Other", slug: "other", logoUrl: null }],
      orderRows: [],
      customerRows: [],
    });

    const [t2] = await service.listActiveWithSummary();
    expect(t2.ordersCount30d).toBe(0);
    expect(t2.revenue30d).toBe(0);
    expect(t2.customersCount).toBe(0);
  });

  it("preserves logo url when present and null otherwise", async () => {
    await buildService({
      activeTenants: [
        { id: "t1", name: "A", slug: "a", logoUrl: "logo.png" },
        { id: "t2", name: "B", slug: "b", logoUrl: null },
      ],
      orderRows: [],
      customerRows: [],
    });

    const result = await service.listActiveWithSummary();
    expect(result.find((r) => r.id === "t1")?.logoUrl).toBe("logo.png");
    expect(result.find((r) => r.id === "t2")?.logoUrl).toBeNull();
  });

  it("returns empty array when no active tenants", async () => {
    await buildService({
      activeTenants: [],
      orderRows: [],
      customerRows: [],
    });

    const result = await service.listActiveWithSummary();
    expect(result).toEqual([]);
  });
});

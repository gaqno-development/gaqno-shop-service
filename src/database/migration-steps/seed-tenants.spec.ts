import { seedDefaultTenants } from "./seed-tenants";
import type { SqlClient } from "./enums";

interface RecordedCall {
  readonly text: string;
  readonly values: readonly unknown[];
}

function createSqlRecorder(
  selectHandler?: (text: string, values: readonly unknown[]) => unknown[],
): {
  readonly sql: SqlClient;
  readonly calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const tagged = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce(
      (acc, chunk, i) =>
        acc + chunk + (i < values.length ? `$${i + 1}` : ""),
      "",
    );
    calls.push({ text, values });
    const rows = selectHandler?.(text, values) ?? [];
    return Promise.resolve(rows);
  };
  (tagged as unknown as { unsafe: (sql: string) => Promise<unknown> }).unsafe =
    (raw: string) => {
      calls.push({ text: raw, values: [] });
      return Promise.resolve([]);
    };
  return { sql: tagged as unknown as SqlClient, calls };
}

function findCall(
  calls: readonly RecordedCall[],
  needle: string,
): RecordedCall | undefined {
  return calls.find((c) => c.text.includes(needle));
}

describe("seedDefaultTenants", () => {
  it("upserts the gaqno-shop tenant with ON CONFLICT DO NOTHING", async () => {
    const { sql, calls } = createSqlRecorder((text) =>
      text.includes("SELECT id FROM tenants")
        ? [{ id: "00000000-0000-0000-0000-000000000001" }]
        : [],
    );
    await seedDefaultTenants(sql);
    const insert = calls.find(
      (c) =>
        c.text.includes("INSERT INTO tenants") &&
        c.values.includes("gaqno-shop"),
    );
    expect(insert).toBeDefined();
    expect(insert?.text).toContain("ON CONFLICT (slug) DO NOTHING");
  });

  it("upserts the fifia-doces tenant pointing at public storefront host", async () => {
    const { sql, calls } = createSqlRecorder((text) =>
      text.includes("SELECT id FROM tenants")
        ? [{ id: "00000000-0000-0000-0000-000000000002" }]
        : [],
    );
    await seedDefaultTenants(sql);
    const insert = calls.find(
      (c) =>
        c.text.includes("INSERT INTO tenants") &&
        c.values.includes("fifia-doces"),
    );
    expect(insert).toBeDefined();
    expect(insert?.values).toContain("fifiadoces.com.br");
    expect(insert?.text).toContain("ON CONFLICT (slug) DO NOTHING");
  });

  it("seeds feature flags with featureBakery enabled for fifia-doces", async () => {
    const { sql, calls } = createSqlRecorder((text) =>
      text.includes("SELECT id FROM tenants")
        ? [{ id: "ff00ff00-0000-0000-0000-000000000002" }]
        : [],
    );
    await seedDefaultTenants(sql);
    const flagInserts = calls.filter(
      (c) =>
        c.text.includes("INSERT INTO tenant_feature_flags") &&
        c.values.includes("ff00ff00-0000-0000-0000-000000000002"),
    );
    expect(flagInserts.length).toBeGreaterThan(0);
    expect(flagInserts[0]?.text).toContain(
      "ON CONFLICT (tenant_id) DO NOTHING",
    );
  });

  it("does not emit feature-flag insert when tenant lookup returns no row", async () => {
    const { sql, calls } = createSqlRecorder(() => []);
    await seedDefaultTenants(sql);
    const flagInserts = calls.filter((c) =>
      c.text.includes("INSERT INTO tenant_feature_flags"),
    );
    expect(flagInserts).toHaveLength(0);
  });

  it("seeds both tenants in deterministic order: gaqno-shop first, fifia-doces second", async () => {
    const { sql, calls } = createSqlRecorder((text) =>
      text.includes("SELECT id FROM tenants")
        ? [{ id: "11111111-1111-1111-1111-111111111111" }]
        : [],
    );
    await seedDefaultTenants(sql);
    const tenantInserts = calls.filter((c) =>
      c.text.includes("INSERT INTO tenants"),
    );
    expect(tenantInserts).toHaveLength(2);
    expect(tenantInserts[0]?.values).toContain("gaqno-shop");
    expect(tenantInserts[1]?.values).toContain("fifia-doces");
  });
});

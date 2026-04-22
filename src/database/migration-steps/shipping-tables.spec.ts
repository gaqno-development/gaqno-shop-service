import { applyShippingTables } from "./shipping-tables";
import type { SqlClient } from "./enums";

function createSqlRecorder(): {
  readonly sql: SqlClient;
  readonly statements: string[];
} {
  const statements: string[] = [];
  const taggedFn = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const interleaved = strings.reduce((acc, str, i) => {
      const val = i < values.length ? String(values[i]) : "";
      return acc + str + val;
    }, "");
    statements.push(interleaved);
    return Promise.resolve([]);
  };
  (taggedFn as unknown as { unsafe: (sql: string) => Promise<unknown> }).unsafe =
    (raw: string) => {
      statements.push(raw);
      return Promise.resolve([]);
    };
  return { sql: taggedFn as unknown as SqlClient, statements };
}

function findStatement(
  statements: readonly string[],
  needle: string,
): string | undefined {
  return statements.find((s) => s.includes(needle));
}

describe("applyShippingTables", () => {
  it("creates shipping_methods table idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyShippingTables(sql);
    const stmt = findStatement(
      statements,
      "CREATE TABLE IF NOT EXISTS shipping_methods",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("tenant_id UUID NOT NULL");
    expect(stmt).toContain("REFERENCES tenants(id)");
  });

  it("creates shipping_rates_cache table idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyShippingTables(sql);
    const stmt = findStatement(
      statements,
      "CREATE TABLE IF NOT EXISTS shipping_rates_cache",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("cache_key");
    expect(stmt).toContain("expires_at TIMESTAMP NOT NULL");
  });

  it("adds slug column to shipping_methods idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyShippingTables(sql);
    const stmt = findStatement(
      statements,
      "ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS slug",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("VARCHAR(50)");
  });

  it("adds is_default column to shipping_methods idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyShippingTables(sql);
    const stmt = findStatement(
      statements,
      "ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS is_default",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("BOOLEAN");
  });

  it("adds handling_days column to shipping_methods idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyShippingTables(sql);
    const stmt = findStatement(
      statements,
      "ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS handling_days",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("INTEGER");
  });

  it("creates shipping indexes idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyShippingTables(sql);
    const tenantIdx = findStatement(statements, "shipping_methods_tenant_idx");
    expect(tenantIdx).toBeDefined();
    expect(tenantIdx).toContain("CREATE INDEX IF NOT EXISTS");
  });
});

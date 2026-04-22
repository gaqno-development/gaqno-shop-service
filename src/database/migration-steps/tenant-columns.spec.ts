import { applyTenantColumns } from "./tenant-columns";
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

describe("applyTenantColumns", () => {
  it("adds vertical column idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = findStatement(statements, "ADD COLUMN IF NOT EXISTS vertical");
    expect(stmt).toBeDefined();
    expect(stmt).toContain("ALTER TABLE tenants");
    expect(stmt).toContain("VARCHAR(20)");
    expect(stmt).toContain("'generic'");
  });

  it("adds layout_hint column idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = findStatement(
      statements,
      "ADD COLUMN IF NOT EXISTS layout_hint",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("ALTER TABLE tenants");
    expect(stmt).toContain("'generic-grid'");
  });

  it("adds terminology_key column idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = findStatement(
      statements,
      "ADD COLUMN IF NOT EXISTS terminology_key",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("ALTER TABLE tenants");
  });

  it("adds feature_bakery column to tenant_feature_flags", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = findStatement(
      statements,
      "ADD COLUMN IF NOT EXISTS feature_bakery",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("ALTER TABLE tenant_feature_flags");
    expect(stmt).toContain("BOOLEAN");
  });

  it("creates payment_provider enum if missing", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = statements.find(
      (s) => s.includes("payment_provider") && s.includes("CREATE TYPE"),
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("DO $$");
    expect(stmt).toContain("mercado_pago");
  });

  it("creates tenant_payment_gateways table idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = findStatement(
      statements,
      "CREATE TABLE IF NOT EXISTS tenant_payment_gateways",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("tenant_id UUID NOT NULL");
    expect(stmt).toContain("REFERENCES tenants(id)");
    expect(stmt).toContain("provider payment_provider NOT NULL");
  });

  it("creates unique index for tenant_id + provider", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyTenantColumns(sql);
    const stmt = findStatement(
      statements,
      "tenant_payment_gateways_tenant_provider_unique",
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
  });
});

import { applyCouponTables } from "./coupon-tables";
import type { SqlClient } from "./enums";

function createSqlRecorder(): {
  readonly sql: SqlClient;
  readonly statements: string[];
} {
  const statements: string[] = [];
  const sql = ((strings: TemplateStringsArray, ..._values: unknown[]) => {
    statements.push(strings.join("?"));
    return Promise.resolve([]);
  }) as unknown as SqlClient;
  return { sql, statements };
}

function findStatement(
  statements: readonly string[],
  needle: string,
): string | undefined {
  return statements.find((s) => s.includes(needle));
}

describe("applyCouponTables", () => {
  it("should create coupons table with idempotent DDL", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyCouponTables(sql);
    const stmt = findStatement(statements, "CREATE TABLE IF NOT EXISTS coupons");
    expect(stmt).toBeDefined();
    expect(stmt).toContain("tenant_id");
    expect(stmt).toContain("code");
    expect(stmt).toContain("type");
    expect(stmt).toContain("value");
    expect(stmt).toContain("min_order");
    expect(stmt).toContain("max_uses");
    expect(stmt).toContain("used_count");
    expect(stmt).toContain("valid_from");
    expect(stmt).toContain("valid_until");
    expect(stmt).toContain("is_active");
  });

  it("should reference tenants with ON DELETE CASCADE", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyCouponTables(sql);
    const stmt = findStatement(statements, "CREATE TABLE IF NOT EXISTS coupons");
    expect(stmt).toContain("REFERENCES tenants(id) ON DELETE CASCADE");
  });

  it("should create index on tenant_id", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyCouponTables(sql);
    const idx = findStatement(statements, "coupons_tenant_idx");
    expect(idx).toBeDefined();
    expect(idx).toContain("IF NOT EXISTS");
  });

  it("should create unique index on (tenant_id, code)", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyCouponTables(sql);
    const idx = findStatement(statements, "coupons_tenant_code_idx");
    expect(idx).toBeDefined();
    expect(idx).toContain("UNIQUE");
    expect(idx).toContain("IF NOT EXISTS");
  });

  it("should be idempotent when run twice", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyCouponTables(sql);
    await applyCouponTables(sql);
    const creates = statements.filter((s) => s.includes("CREATE TABLE"));
    expect(creates).toHaveLength(2);
    for (const s of creates) {
      expect(s).toContain("IF NOT EXISTS");
    }
  });
});

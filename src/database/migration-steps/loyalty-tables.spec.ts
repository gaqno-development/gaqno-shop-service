import { applyLoyaltyTables } from "./loyalty-tables";
import type { SqlClient } from "./enums";

function createSqlRecorder(): { readonly sql: SqlClient; readonly statements: string[] } {
  const statements: string[] = [];
  const sql = ((strings: TemplateStringsArray, ..._values: unknown[]) => {
    statements.push(strings.join("?"));
    return Promise.resolve([]);
  }) as unknown as SqlClient;
  return { sql, statements };
}

function findStatement(statements: readonly string[], needle: string): string | undefined {
  return statements.find((s) => s.includes(needle));
}

describe("applyLoyaltyTables", () => {
  it("should create customer_points with idempotent DDL", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyLoyaltyTables(sql);
    const stmt = findStatement(statements, "customer_points");
    expect(stmt).toBeDefined();
    expect(stmt).toContain("CREATE TABLE IF NOT EXISTS customer_points");
    expect(stmt).toContain("tenant_id");
    expect(stmt).toContain("balance");
    expect(stmt).toContain("tier");
  });

  it("should create points_transactions with idempotent DDL", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyLoyaltyTables(sql);
    const stmt = findStatement(statements, "points_transactions");
    expect(stmt).toContain("CREATE TABLE IF NOT EXISTS points_transactions");
    expect(stmt).toContain("amount");
    expect(stmt).toContain("type");
  });

  it("should create points_redemption_history with idempotent DDL", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyLoyaltyTables(sql);
    const stmt = findStatement(statements, "points_redemption_history");
    expect(stmt).toContain("CREATE TABLE IF NOT EXISTS points_redemption_history");
    expect(stmt).toContain("points_redeemed");
    expect(stmt).toContain("discount_received");
  });

  it("should create customer_tier_rules with idempotent DDL", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyLoyaltyTables(sql);
    const stmt = findStatement(statements, "customer_tier_rules");
    expect(stmt).toContain("CREATE TABLE IF NOT EXISTS customer_tier_rules");
    expect(stmt).toContain("min_points");
    expect(stmt).toContain("points_multiplier");
  });

  it("should create all expected indexes with IF NOT EXISTS", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyLoyaltyTables(sql);
    const indexStatements = statements.filter((s) => s.includes("CREATE"));
    const indexOnly = indexStatements.filter((s) => s.includes("INDEX"));
    expect(indexOnly.length).toBeGreaterThan(0);
    for (const s of indexOnly) {
      expect(s).toContain("IF NOT EXISTS");
    }
  });

  it("should be safe to run twice (idempotent)", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyLoyaltyTables(sql);
    await applyLoyaltyTables(sql);
    const creates = statements.filter((s) => s.includes("CREATE TABLE"));
    expect(creates).toHaveLength(8);
    for (const s of creates) {
      expect(s).toContain("IF NOT EXISTS");
    }
  });
});

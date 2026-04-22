import { applyWishlistTables } from "./wishlist-tables";
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

describe("applyWishlistTables", () => {
  it("creates wishlists table idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyWishlistTables(sql);
    const stmt = statements.find((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS wishlists"),
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("tenant_id UUID NOT NULL");
    expect(stmt).toContain("customer_id UUID NOT NULL");
    expect(stmt).toContain("REFERENCES customers(id)");
  });

  it("creates wishlist_items table idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyWishlistTables(sql);
    const stmt = statements.find((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS wishlist_items"),
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("wishlist_id");
    expect(stmt).toContain("product_id");
  });

  it("creates wishlist unique index on wishlist_id + product_id", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyWishlistTables(sql);
    const stmt = statements.find((s) =>
      s.includes("wishlist_items_unique_idx"),
    );
    expect(stmt).toBeDefined();
    expect(stmt).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
  });
});

import { applyBakeryTables } from "./bakery-tables";
import type { SqlClient } from "./enums";

function createSqlRecorder(): {
  readonly sql: SqlClient;
  readonly statements: string[];
} {
  const statements: string[] = [];
  const taggedFn = (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
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

const BAKERY_TABLES = [
  "bakery_ingredients",
  "bakery_recipes",
  "bakery_recipe_ingredients",
  "bakery_product_ingredients",
  "bakery_inventory_movements",
  "bakery_decorations",
  "bakery_product_decorations",
  "bakery_order_item_decorations",
  "bakery_product_sizes",
  "bakery_admin_events",
  "bakery_site_settings",
];

describe("applyBakeryTables", () => {
  it.each(BAKERY_TABLES)(
    "creates %s with idempotent DDL",
    async (tableName) => {
      const { sql, statements } = createSqlRecorder();
      await applyBakeryTables(sql);
      const stmt = findStatement(statements, tableName);
      expect(stmt).toBeDefined();
      expect(stmt).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
      expect(stmt).toContain("tenant_id");
    },
  );

  it("creates bakery decoration type enum guarded against duplicate", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const stmt = findStatement(statements, "bakery_decoration_type");
    expect(stmt).toContain("CREATE TYPE bakery_decoration_type AS ENUM");
    expect(stmt).toContain("EXCEPTION WHEN duplicate_object");
  });

  it("extends order_status enum with bakery-specific values", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const reviewStmt = findStatement(
      statements,
      "awaiting_decoration_review",
    );
    const approvedStmt = findStatement(statements, "decoration_approved");
    expect(reviewStmt).toBeDefined();
    expect(approvedStmt).toBeDefined();
  });

  it("extends order_status enum using ALTER TYPE ADD VALUE IF NOT EXISTS (no parameterized binds inside DO blocks)", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const reviewStmt = findStatement(statements, "awaiting_decoration_review");
    const approvedStmt = findStatement(statements, "decoration_approved");
    expect(reviewStmt).toBeDefined();
    expect(approvedStmt).toBeDefined();
    for (const stmt of [reviewStmt, approvedStmt] as string[]) {
      expect(stmt).toContain(
        "ALTER TYPE order_status ADD VALUE IF NOT EXISTS",
      );
      expect(stmt).not.toMatch(/\$\d+/);
    }
  });

  it("adds feature_bakery column to tenant_feature_flags (idempotent)", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const stmt = findStatement(statements, "tenant_feature_flags");
    expect(stmt).toContain("ADD COLUMN IF NOT EXISTS feature_bakery");
  });

  it("extends products with allows_reference_image, lead_days, recipe_id", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const joined = statements.join("\n");
    expect(joined).toContain("ADD COLUMN IF NOT EXISTS allows_reference_image");
    expect(joined).toContain("ADD COLUMN IF NOT EXISTS lead_days");
    expect(joined).toContain("ADD COLUMN IF NOT EXISTS recipe_id");
  });

  it("extends order_items with reference_image_url, size, notes", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const joined = statements.join("\n");
    expect(joined).toContain("ADD COLUMN IF NOT EXISTS reference_image_url");
    expect(joined).toContain("ADD COLUMN IF NOT EXISTS size");
    expect(joined).toContain("ADD COLUMN IF NOT EXISTS notes");
  });

  it("adds FK from products.recipe_id to bakery_recipes(id) guarded against duplicate", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    const stmt = findStatement(statements, "products_recipe_id_fkey");
    expect(stmt).toBeDefined();
    expect(stmt).toContain("FOREIGN KEY (recipe_id) REFERENCES bakery_recipes");
  });

  it("is safe to run twice (idempotent)", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyBakeryTables(sql);
    await applyBakeryTables(sql);
    const creates = statements.filter((s) => s.includes("CREATE TABLE"));
    expect(creates).toHaveLength(BAKERY_TABLES.length * 2);
    for (const s of creates) {
      expect(s).toContain("IF NOT EXISTS");
    }
  });
});

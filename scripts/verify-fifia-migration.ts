import * as dotenv from "dotenv";
import * as path from "path";
import { Pool } from "pg";
import type { PoolClient } from "pg";

dotenv.config({ path: path.join(__dirname, "../.env") });

const SRC_URL = process.env.FIFIA_DATABASE_URL;
const DST_URL = process.env.DATABASE_URL;
const TENANT_SLUG = process.env.FIFIA_TENANT_SLUG ?? "fifia-doces";

if (!SRC_URL || !DST_URL) {
  console.error("Missing FIFIA_DATABASE_URL (source) and/or DATABASE_URL (target).");
  process.exit(1);
}

const src = new Pool({ connectionString: SRC_URL, max: 1 });
const dst = new Pool({ connectionString: DST_URL, max: 1 });

interface CountCheck {
  label: string;
  sourceQuery: string;
  sourceArgs?: readonly unknown[];
  targetQuery: string;
  targetArgs: readonly unknown[];
}

interface TotalCheck {
  label: string;
  sourceQuery: string;
  sourceArgs?: readonly unknown[];
  targetQuery: string;
  targetArgs: readonly unknown[];
}

async function countRows(
  client: PoolClient,
  sql: string,
  args: readonly unknown[] = [],
): Promise<number> {
  const res = await client.query<{ count: string }>(sql, args as unknown[]);
  return Number(res.rows[0]?.count ?? 0);
}

async function totalSum(
  client: PoolClient,
  sql: string,
  args: readonly unknown[] = [],
): Promise<number> {
  const res = await client.query<{ total: string | null }>(sql, args as unknown[]);
  return Number(res.rows[0]?.total ?? 0);
}

async function resolveTenantId(d: PoolClient): Promise<string> {
  const res = await d.query(
    `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
    [TENANT_SLUG],
  );
  if (!res.rows[0]) {
    throw new Error(`Tenant '${TENANT_SLUG}' not found.`);
  }
  return String(res.rows[0].id);
}

function pass(label: string, source: number, target: number): void {
  console.log(`  ✓ ${label}: source=${source} target=${target}`);
}

function fail(label: string, source: number, target: number): never {
  console.error(`  ✗ ${label}: source=${source} target=${target}`);
  throw new Error(`Verification failed for ${label}`);
}

async function run(): Promise<void> {
  const s = await src.connect();
  const d = await dst.connect();
  try {
    const tenantId = await resolveTenantId(d);
    console.log(`[verify] tenant=${TENANT_SLUG} (${tenantId})\n`);

    const countChecks: CountCheck[] = [
      {
        label: "categories",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Category"`,
        targetQuery: `SELECT COUNT(*) AS count FROM categories WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "products",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Product"`,
        targetQuery: `SELECT COUNT(*) AS count FROM products WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "product_sizes",
        sourceQuery: `SELECT COUNT(*) AS count FROM "ProductSize"`,
        targetQuery: `SELECT COUNT(*) AS count FROM bakery_product_sizes WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "ingredients",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Ingredient"`,
        targetQuery: `SELECT COUNT(*) AS count FROM bakery_ingredients WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "recipes",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Recipe"`,
        targetQuery: `SELECT COUNT(*) AS count FROM bakery_recipes WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "decorations",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Decoration"`,
        targetQuery: `SELECT COUNT(*) AS count FROM bakery_decorations WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "coupons",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Coupon"`,
        targetQuery: `SELECT COUNT(*) AS count FROM coupons WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "shipping_zones",
        sourceQuery: `SELECT COUNT(*) AS count FROM "ShippingZone"`,
        targetQuery: `SELECT COUNT(*) AS count FROM shipping_methods WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "customers (all users)",
        sourceQuery: `SELECT COUNT(*) AS count FROM "User"`,
        targetQuery: `SELECT COUNT(*) AS count FROM customers WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "addresses",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Address"`,
        targetQuery: `SELECT COUNT(*) AS count FROM customer_addresses WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "orders",
        sourceQuery: `SELECT COUNT(*) AS count FROM "Order"`,
        targetQuery: `SELECT COUNT(*) AS count FROM orders WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "order_items",
        sourceQuery: `SELECT COUNT(*) AS count FROM "OrderItem"`,
        targetQuery: `SELECT COUNT(*) AS count FROM order_items WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "order_timeline",
        sourceQuery: `SELECT COUNT(*) AS count FROM "OrderTimeline"`,
        targetQuery: `SELECT COUNT(*) AS count FROM order_status_history WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "inventory_movements",
        sourceQuery: `SELECT COUNT(*) AS count FROM "InventoryMovement"`,
        targetQuery: `SELECT COUNT(*) AS count FROM bakery_inventory_movements WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "admin_events",
        sourceQuery: `SELECT COUNT(*) AS count FROM "AdminEvent"`,
        targetQuery: `SELECT COUNT(*) AS count FROM bakery_admin_events WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
    ];

    console.log("Row counts:");
    for (const check of countChecks) {
      const source = await countRows(s, check.sourceQuery, check.sourceArgs);
      const target = await countRows(d, check.targetQuery, check.targetArgs);
      if (source === target) {
        pass(check.label, source, target);
      } else {
        fail(check.label, source, target);
      }
    }

    const totalChecks: TotalCheck[] = [
      {
        label: "orders.subtotal sum",
        sourceQuery: `SELECT COALESCE(SUM(subtotal), 0)::text AS total FROM "Order"`,
        targetQuery: `SELECT COALESCE(SUM(subtotal), 0)::text AS total FROM orders WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "orders.total sum",
        sourceQuery: `SELECT COALESCE(SUM(total), 0)::text AS total FROM "Order"`,
        targetQuery: `SELECT COALESCE(SUM(total), 0)::text AS total FROM orders WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "orders.discount sum",
        sourceQuery: `SELECT COALESCE(SUM(discount), 0)::text AS total FROM "Order"`,
        targetQuery: `SELECT COALESCE(SUM(discount_amount), 0)::text AS total FROM orders WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
      {
        label: "order_items.total sum",
        sourceQuery: `SELECT COALESCE(SUM("totalPrice"), 0)::text AS total FROM "OrderItem"`,
        targetQuery: `SELECT COALESCE(SUM(total), 0)::text AS total FROM order_items WHERE tenant_id = $1`,
        targetArgs: [tenantId],
      },
    ];

    console.log("\nMoney totals (R$, tolerance 0.01):");
    for (const check of totalChecks) {
      const source = await totalSum(s, check.sourceQuery, check.sourceArgs);
      const target = await totalSum(d, check.targetQuery, check.targetArgs);
      if (Math.abs(source - target) < 0.01) {
        pass(check.label, source, target);
      } else {
        fail(check.label, source, target);
      }
    }

    console.log("\n[verify] all checks passed ✅");
  } finally {
    s.release();
    d.release();
    await src.end();
    await dst.end();
  }
}

run().catch((err) => {
  console.error("[verify] FAILED:", err.message);
  process.exit(1);
});

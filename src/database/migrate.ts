import postgres from "postgres";
import type { SqlClient } from "./migration-steps/enums";
import { createEnums } from "./migration-steps/enums";
import { createTenantTables } from "./migration-steps/tenant-tables";
import { createCatalogTables } from "./migration-steps/catalog-tables";
import { createCustomerTables } from "./migration-steps/customer-tables";
import { createOrderTables } from "./migration-steps/order-tables";
import { seedDefaultTenants } from "./migration-steps/seed-tenants";
import { createDropshippingTables } from "./migration-steps/dropshipping-tables";
import { applyDropshippingColumns } from "./migration-steps/dropshipping-columns";
import { applyOAuthAccountsTable } from "./migration-steps/oauth-tables";
import { applyLoyaltyTables } from "./migration-steps/loyalty-tables";
import { applyBakeryTables } from "./migration-steps/bakery-tables";
import { applyCouponTables } from "./migration-steps/coupon-tables";
import { applyTenantColumns } from "./migration-steps/tenant-columns";

async function tableExists(sql: SqlClient, tableName: string): Promise<boolean> {
  const result = await sql`SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
  )`;
  return Boolean(result[0]?.exists);
}

async function runInitialMigration(sql: SqlClient): Promise<void> {
  console.log("🔄 Running initial migration...");
  await createEnums(sql);
  await createTenantTables(sql);
  await createCatalogTables(sql);
  await createCustomerTables(sql);
  await createOrderTables(sql);
  await seedDefaultTenants(sql);
}

async function runDropshippingMigration(sql: SqlClient): Promise<void> {
  console.log("🔄 Applying dropshipping migration...");
  await createDropshippingTables(sql);
  await applyDropshippingColumns(sql);
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  console.log("🔄 Checking database migrations...");
  const sql = postgres(databaseUrl);

  try {
    if (!(await tableExists(sql, "tenants"))) {
      await runInitialMigration(sql);
    }
    if (!(await tableExists(sql, "dropshipping_providers"))) {
      await runDropshippingMigration(sql);
    } else {
      await applyDropshippingColumns(sql);
    }
    await applyOAuthAccountsTable(sql);
    await applyTenantColumns(sql);
    await applyLoyaltyTables(sql);
    await applyBakeryTables(sql);
    await applyCouponTables(sql);
    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

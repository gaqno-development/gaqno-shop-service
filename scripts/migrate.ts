#!/usr/bin/env node
/**
 * Database migration script for gaqno-shop-service
 * Run with: npx ts-node scripts/migrate.ts
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.production" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL not found in environment");
  process.exit(1);
}

async function migrate() {
  console.log("🔄 Starting database migration...");
  
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Read migration file
    const migrationPath = join(__dirname, "..", "src", "database", "migrations", "0000_initial.sql");
    const sql = readFileSync(migrationPath, "utf-8");

    // Execute migration
    console.log("📦 Executing migration...");
    await client.unsafe(sql);

    console.log("✅ Migration completed successfully!");
    console.log("📝 Tables created:");
    console.log("   - tenants");
    console.log("   - tenant_feature_flags");
    console.log("   - categories");
    console.log("   - products");
    console.log("   - product_variations");
    console.log("   - customers");
    console.log("   - customer_addresses");
    console.log("   - orders");
    console.log("   - order_items");
    console.log("   - order_status_history");
    console.log("   - carts");
    console.log("\n🔐 RLS policies applied");
    console.log("🏪 Default tenants created: gaqno-shop, fifia-doces");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();

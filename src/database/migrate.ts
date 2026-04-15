import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

export async function runMigrations(databaseUrl: string): Promise<void> {
  console.log("🔄 Checking database migrations...");
  
  const sql = postgres(databaseUrl);
  
  try {
    const result = await sql`SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tenants'
    )`;
    
    const tenantsExists = result[0]?.exists;
    
    if (tenantsExists) {
      console.log("✅ Database already migrated");
      await sql.end();
      return;
    }
    
    console.log("🔄 Running initial migration...");
    
    const migrationPath = join(__dirname, "migrations", "0000_initial.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");
    
    await sql.unsafe(migrationSql);
    
    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

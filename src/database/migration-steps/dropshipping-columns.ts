import type { SqlClient } from "./enums";

export async function applyDropshippingColumns(sql: SqlClient): Promise<void> {
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS source_provider VARCHAR(40)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS source_product_id VARCHAR(100)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS source_variation_ids JSONB DEFAULT '{}'`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS source_cost_amount DECIMAL(10, 2)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS source_cost_currency VARCHAR(3)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_override_percent DECIMAL(5, 2)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20)`;
  await sql`CREATE INDEX IF NOT EXISTS products_source_idx ON products(source_provider, source_product_id)`;

  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(20) DEFAULT 'own'`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(30)`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_order_id VARCHAR(100)`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_provider_code VARCHAR(40)`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_tracking_code VARCHAR(100)`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_tracking_url VARCHAR(500)`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS on_hold_reason TEXT`;
}

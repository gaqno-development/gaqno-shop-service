import type { SqlClient } from "./enums";

export async function applyShippingTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS shipping_methods (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(50) NOT NULL DEFAULT '',
      carrier VARCHAR(50) NOT NULL,
      service_code VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      is_default BOOLEAN DEFAULT false,
      free_shipping_threshold DECIMAL(10, 2),
      flat_rate DECIMAL(10, 2),
      handling_days INTEGER DEFAULT 1,
      estimated_delivery_days_min INTEGER,
      estimated_delivery_days_max INTEGER,
      settings JSONB DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS slug VARCHAR(50) DEFAULT ''`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS handling_days INTEGER DEFAULT 1`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS estimated_delivery_days_min INTEGER`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS estimated_delivery_days_max INTEGER`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS free_shipping_threshold DECIMAL(10, 2)`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS flat_rate DECIMAL(10, 2)`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'`;
  await sql`ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;

  await sql`CREATE INDEX IF NOT EXISTS shipping_methods_tenant_idx ON shipping_methods(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS shipping_methods_tenant_slug_idx ON shipping_methods(tenant_id, slug)`;

  await sql`
    CREATE TABLE IF NOT EXISTS shipping_rates_cache (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      cache_key VARCHAR(255) NOT NULL,
      cep VARCHAR(9) NOT NULL,
      product_ids JSONB NOT NULL DEFAULT '[]',
      rates JSONB NOT NULL DEFAULT '[]',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS shipping_cache_tenant_idx ON shipping_rates_cache(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS shipping_cache_key_idx ON shipping_rates_cache(tenant_id, cache_key)`;
  await sql`CREATE INDEX IF NOT EXISTS shipping_cache_expires_idx ON shipping_rates_cache(expires_at)`;
}

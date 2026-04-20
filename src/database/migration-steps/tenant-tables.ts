import type { SqlClient } from "./enums";

export async function createTenantTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE tenants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      slug VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) UNIQUE,
      description TEXT,
      primary_color VARCHAR(7) DEFAULT '#e11d48',
      bg_color VARCHAR(7) DEFAULT '#ffffff',
      secondary_color VARCHAR(7) DEFAULT '#f9a8d4',
      logo_url VARCHAR(500),
      favicon_url VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      is_dropshipping BOOLEAN DEFAULT false,
      order_prefix VARCHAR(10) DEFAULT 'ORD',
      mercado_pago_access_token VARCHAR(500),
      mercado_pago_public_key VARCHAR(500),
      mercado_pago_webhook_secret VARCHAR(500),
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX tenants_slug_idx ON tenants(slug)`;
  await sql`CREATE UNIQUE INDEX tenants_domain_idx ON tenants(domain)`;

  await sql`
    CREATE TABLE tenant_feature_flags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      feature_shipping BOOLEAN DEFAULT true,
      feature_decorations BOOLEAN DEFAULT true,
      feature_coupons BOOLEAN DEFAULT true,
      feature_recipes BOOLEAN DEFAULT false,
      feature_inventory BOOLEAN DEFAULT true,
      feature_checkout_pro BOOLEAN DEFAULT true,
      feature_pix BOOLEAN DEFAULT true,
      feature_dropshipping BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE UNIQUE INDEX feature_flags_tenant_idx ON tenant_feature_flags(tenant_id)`;
}

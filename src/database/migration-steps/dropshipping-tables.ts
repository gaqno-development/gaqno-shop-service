import type { SqlClient } from "./enums";

export async function createDropshippingTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS dropshipping_providers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider_code VARCHAR(40) NOT NULL,
      credentials_encrypted TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      default_margin_percent DECIMAL(5, 2) NOT NULL DEFAULT 80.00,
      rounding_rule VARCHAR(20) DEFAULT 'none',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS dropshipping_providers_tenant_idx ON dropshipping_providers(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS dropshipping_providers_unique_idx ON dropshipping_providers(tenant_id, provider_code)`;

  await sql`
    CREATE TABLE IF NOT EXISTS dropshipping_fx_rates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      rate_date VARCHAR(10) NOT NULL,
      currency_from VARCHAR(3) NOT NULL,
      currency_to VARCHAR(3) NOT NULL,
      rate DECIMAL(12, 6) NOT NULL,
      source VARCHAR(40) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS dropshipping_fx_rates_unique_idx ON dropshipping_fx_rates(rate_date, currency_from, currency_to)`;

  await sql`
    CREATE TABLE IF NOT EXISTS dropshipping_sync_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      provider_code VARCHAR(40) NOT NULL,
      event_type VARCHAR(60) NOT NULL,
      payload_request JSONB DEFAULT '{}',
      payload_response JSONB DEFAULT '{}',
      success BOOLEAN NOT NULL,
      error_code VARCHAR(60),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS dropshipping_sync_log_tenant_idx ON dropshipping_sync_log(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS dropshipping_sync_log_order_idx ON dropshipping_sync_log(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS dropshipping_sync_log_event_idx ON dropshipping_sync_log(event_type)`;
}

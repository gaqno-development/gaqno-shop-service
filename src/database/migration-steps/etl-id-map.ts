import type { SqlClient } from "./enums";

export async function applyEtlIdMap(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS etl_id_map (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      source_table VARCHAR(64) NOT NULL,
      source_id VARCHAR(128) NOT NULL,
      target_id UUID NOT NULL,
      migrated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS etl_id_map_lookup_idx ON etl_id_map(tenant_id, source_table, source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS etl_id_map_tenant_idx ON etl_id_map(tenant_id)`;
}

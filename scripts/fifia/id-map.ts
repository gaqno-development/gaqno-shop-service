import type { PoolClient } from "pg";

export interface IdMap {
  lookup(sourceTable: string, sourceId: string): Promise<string | null>;
  remember(
    sourceTable: string,
    sourceId: string,
    targetId: string,
  ): Promise<void>;
  ensure(
    sourceTable: string,
    sourceId: string,
    factory: () => Promise<string>,
  ): Promise<string>;
}

export function createIdMap(client: PoolClient, tenantId: string): IdMap {
  return {
    async lookup(sourceTable, sourceId) {
      const res = await client.query(
        `SELECT target_id FROM etl_id_map
         WHERE tenant_id = $1 AND source_table = $2 AND source_id = $3
         LIMIT 1`,
        [tenantId, sourceTable, sourceId],
      );
      const row = res.rows[0];
      return row ? String(row.target_id) : null;
    },
    async remember(sourceTable, sourceId, targetId) {
      await client.query(
        `INSERT INTO etl_id_map (tenant_id, source_table, source_id, target_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, source_table, source_id) DO NOTHING`,
        [tenantId, sourceTable, sourceId, targetId],
      );
    },
    async ensure(sourceTable, sourceId, factory) {
      const existing = await this.lookup(sourceTable, sourceId);
      if (existing) return existing;
      const created = await factory();
      await this.remember(sourceTable, sourceId, created);
      return created;
    },
  };
}

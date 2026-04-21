import * as dotenv from "dotenv";
import * as path from "path";
import { Pool } from "pg";

dotenv.config({ path: path.join(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const TENANT_SLUG = "fifia-doces";
const TENANT_NAME = "Fifia Doces";
const TENANT_DOMAIN = "fifiadoces.gaqno.com.br";

async function ensureTenant(client: import("pg").PoolClient): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
    [TENANT_SLUG],
  );
  if (existing.rows[0]) {
    console.log(`Tenant '${TENANT_SLUG}' exists: ${existing.rows[0].id}`);
    await client.query(
      `UPDATE tenants
       SET name = $1, domain = $2, is_active = true, updated_at = NOW()
       WHERE id = $3`,
      [TENANT_NAME, TENANT_DOMAIN, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }
  const inserted = await client.query(
    `INSERT INTO tenants (slug, name, domain, is_active, primary_color, secondary_color, order_prefix)
     VALUES ($1, $2, $3, true, '#e11d48', '#f9a8d4', 'FIF')
     RETURNING id`,
    [TENANT_SLUG, TENANT_NAME, TENANT_DOMAIN],
  );
  console.log(`Created tenant '${TENANT_SLUG}' (${inserted.rows[0].id})`);
  return inserted.rows[0].id;
}

async function ensureFeatureFlags(
  client: import("pg").PoolClient,
  tenantId: string,
) {
  const existing = await client.query(
    `SELECT id FROM tenant_feature_flags WHERE tenant_id = $1 LIMIT 1`,
    [tenantId],
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE tenant_feature_flags
       SET feature_bakery = true, feature_shipping = true, feature_coupons = true, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId],
    );
    console.log(`Feature flags updated (featureBakery = true)`);
    return;
  }
  await client.query(
    `INSERT INTO tenant_feature_flags
       (tenant_id, feature_shipping, feature_coupons, feature_bakery)
     VALUES ($1, true, true, true)`,
    [tenantId],
  );
  console.log(`Feature flags inserted (featureBakery = true)`);
}

async function run() {
  const client = await pool.connect();
  try {
    const tenantId = await ensureTenant(client);
    await ensureFeatureFlags(client, tenantId);
    console.log(`Done. Tenant ID: ${tenantId}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

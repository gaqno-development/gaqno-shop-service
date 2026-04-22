import * as dotenv from "dotenv";
import * as path from "path";
import { Pool } from "pg";
import type { PoolClient } from "pg";

dotenv.config({ path: path.join(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const TENANT_SLUG = "fifia-doces";
const TENANT_NAME = "Fifia Doces";
const TENANT_DOMAIN = "fifiadoces.com.br";
const ADMIN_DOMAIN = "fifiadoces.gaqno.com.br";
const PRIMARY_COLOR = "#e11d48";
const SECONDARY_COLOR = "#f9a8d4";
const BG_COLOR = "#fffbf7";
const ORDER_PREFIX = "FIF";

async function ensureTenant(client: PoolClient): Promise<string> {
  await client.query(
    `INSERT INTO tenants (
       slug, name, domain, order_prefix,
       primary_color, bg_color, secondary_color,
       is_active, settings
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       domain = EXCLUDED.domain,
       order_prefix = EXCLUDED.order_prefix,
       is_active = true,
       settings = tenants.settings || EXCLUDED.settings,
       updated_at = NOW()`,
    [
      TENANT_SLUG,
      TENANT_NAME,
      TENANT_DOMAIN,
      ORDER_PREFIX,
      PRIMARY_COLOR,
      BG_COLOR,
      SECONDARY_COLOR,
      JSON.stringify({
        defaultCurrency: "BRL",
        adminDomain: ADMIN_DOMAIN,
        source: "fifia_doces",
      }),
    ],
  );
  const row = await client.query(
    `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
    [TENANT_SLUG],
  );
  if (!row.rows[0]) {
    throw new Error(`Failed to upsert tenant '${TENANT_SLUG}'`);
  }
  return String(row.rows[0].id);
}

async function ensureFeatureFlags(
  client: PoolClient,
  tenantId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO tenant_feature_flags (
       tenant_id, feature_shipping, feature_decorations, feature_coupons,
       feature_recipes, feature_inventory, feature_checkout_pro, feature_pix,
       feature_dropshipping, feature_bakery
     )
     VALUES ($1, true, true, true, true, true, true, true, false, true)
     ON CONFLICT (tenant_id) DO UPDATE SET
       feature_shipping = true,
       feature_decorations = true,
       feature_coupons = true,
       feature_recipes = true,
       feature_inventory = true,
       feature_checkout_pro = true,
       feature_pix = true,
       feature_bakery = true,
       updated_at = NOW()`,
    [tenantId],
  );
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    const tenantId = await ensureTenant(client);
    await ensureFeatureFlags(client, tenantId);
    console.log(
      `[provision] tenant '${TENANT_SLUG}' (${tenantId}) ready at public=${TENANT_DOMAIN} admin=${ADMIN_DOMAIN}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

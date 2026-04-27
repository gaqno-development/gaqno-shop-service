import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import type { PoolClient } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const PROVIDER_CODE = process.env.PROVIDER_CODE || "aliexpress";
const MARGIN_PERCENT = process.env.MARGIN_PERCENT || "80.00";
const ROUNDING_RULE = process.env.ROUNDING_RULE || "none";
const TENANT_SLUG = process.env.TENANT_SLUG || "gaqno-shop";

async function resolveTenant(client: PoolClient): Promise<string> {
  const row = await client.query(
    `SELECT id, slug, name FROM tenants WHERE slug = $1 LIMIT 1`,
    [TENANT_SLUG],
  );
  if (!row.rows[0]) {
    throw new Error(`Tenant '${TENANT_SLUG}' not found in shop database`);
  }
  return String(row.rows[0].id);
}

async function ensureProvider(
  client: PoolClient,
  tenantId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO dropshipping_providers (
       tenant_id, provider_code, is_active,
       default_margin_percent, rounding_rule
     )
     VALUES ($1, $2, true, $3, $4)
     ON CONFLICT (tenant_id, provider_code) DO UPDATE SET
       is_active = true,
       default_margin_percent = EXCLUDED.default_margin_percent,
       rounding_rule = EXCLUDED.rounding_rule,
       updated_at = NOW()`,
    [tenantId, PROVIDER_CODE, MARGIN_PERCENT, ROUNDING_RULE],
  );
  console.log(
    `[provision] provider '${PROVIDER_CODE}' configured for tenant ${tenantId} (margin: ${MARGIN_PERCENT}%, rounding: ${ROUNDING_RULE})`,
  );
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    const tenantId = await resolveTenant(client);
    await ensureProvider(client, tenantId);
    console.log(`[provision] dropshipping provider ready for tenant '${TENANT_SLUG}'`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

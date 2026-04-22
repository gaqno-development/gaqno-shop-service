DO $$ BEGIN
  CREATE TYPE "payment_provider" AS ENUM('mercado_pago', 'stripe', 'pagseguro');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_payment_gateways" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider" "payment_provider" NOT NULL,
  "credentials" JSONB DEFAULT '{}'::jsonb,
  "is_active" BOOLEAN DEFAULT false,
  "is_default" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payment_gateways_tenant_provider_unique"
  ON "tenant_payment_gateways"("tenant_id", "provider");
CREATE INDEX IF NOT EXISTS "tenant_payment_gateways_tenant_idx"
  ON "tenant_payment_gateways"("tenant_id");

-- Migrate legacy MP credentials from tenants to the new per-gateway table.
INSERT INTO "tenant_payment_gateways" ("tenant_id", "provider", "credentials", "is_active", "is_default")
SELECT
  "id",
  'mercado_pago',
  jsonb_build_object(
    'access_token', "mercado_pago_access_token",
    'public_key', "mercado_pago_public_key",
    'webhook_secret', "mercado_pago_webhook_secret"
  ),
  CASE WHEN "mercado_pago_access_token" IS NOT NULL THEN true ELSE false END,
  true
FROM "tenants"
WHERE "mercado_pago_access_token" IS NOT NULL
   OR "mercado_pago_public_key" IS NOT NULL
   OR "mercado_pago_webhook_secret" IS NOT NULL
ON CONFLICT ("tenant_id", "provider") DO NOTHING;

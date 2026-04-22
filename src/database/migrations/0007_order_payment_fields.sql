-- Fase B: Additional order columns for robust payment tracking (parity with fifia_doces)

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "pix_expires_at" timestamp,
  ADD COLUMN IF NOT EXISTS "payment_provider" "payment_provider",
  ADD COLUMN IF NOT EXISTS "payment_idempotency_key" varchar(120),
  ADD COLUMN IF NOT EXISTS "payment_gateway_id" uuid REFERENCES "tenant_payment_gateways"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "payment_failure_reason" text,
  ADD COLUMN IF NOT EXISTS "webhook_last_received_at" timestamp;

CREATE INDEX IF NOT EXISTS "orders_payment_external_id_idx"
  ON "orders" ("tenant_id", "payment_external_id");

CREATE INDEX IF NOT EXISTS "orders_pix_expires_idx"
  ON "orders" ("tenant_id", "pix_expires_at")
  WHERE "payment_status" = 'pending';

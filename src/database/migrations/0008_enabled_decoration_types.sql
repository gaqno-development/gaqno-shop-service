-- Fase 8: Dynamic product customization types (replaces fixed decoration types)

-- Create new dynamic customization types table
CREATE TABLE IF NOT EXISTS "product_customization_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "customization_types_tenant_idx"
  ON "product_customization_types" ("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customization_types_tenant_slug_idx"
  ON "product_customization_types" ("tenant_id", "slug");

-- Add reference column to decorations
ALTER TABLE "bakery_decorations"
  ADD COLUMN IF NOT EXISTS "customization_type_id" uuid
  REFERENCES "product_customization_types"("id") ON DELETE SET NULL;

-- Replace the old JSON column with new array of UUIDs
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "enabled_customization_type_ids" jsonb DEFAULT '[]';

-- Migrate existing data: map old string types to new format
-- We'll need default types seeded per tenant later
-- For now, products with decorations enabled get empty array (all available)
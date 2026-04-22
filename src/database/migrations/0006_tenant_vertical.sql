ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "vertical" varchar(20) DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS "layout_hint" varchar(50) DEFAULT 'generic-grid',
  ADD COLUMN IF NOT EXISTS "terminology_key" varchar(50) DEFAULT 'generic';

UPDATE "tenants" SET "vertical" = 'generic' WHERE "vertical" IS NULL;
UPDATE "tenants" SET "layout_hint" = 'generic-grid' WHERE "layout_hint" IS NULL;
UPDATE "tenants" SET "terminology_key" = 'generic' WHERE "terminology_key" IS NULL;

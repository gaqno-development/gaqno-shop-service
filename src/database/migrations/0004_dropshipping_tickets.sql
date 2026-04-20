CREATE TABLE IF NOT EXISTS "dropshipping_order_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "provider_code" varchar(40) NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "failure_reason" text NOT NULL,
  "failure_kind" varchar(40) NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "resolution_notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "resolved_at" timestamp,
  CONSTRAINT "dropshipping_order_tickets_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "dropshipping_order_tickets_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "dropshipping_tickets_tenant_idx" ON "dropshipping_order_tickets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "dropshipping_tickets_order_idx" ON "dropshipping_order_tickets" ("order_id");
CREATE INDEX IF NOT EXISTS "dropshipping_tickets_status_idx" ON "dropshipping_order_tickets" ("status");

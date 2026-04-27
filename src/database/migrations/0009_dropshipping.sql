-- Add dropshipping columns to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_provider" varchar(40);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_product_id" varchar(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_variation_ids" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_cost_amount" numeric(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_cost_currency" varchar(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "margin_override_percent" numeric(5, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sync_status" varchar(20);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allows_reference_image" boolean DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lead_days" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allows_additional_decorations" boolean DEFAULT true;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "enabled_customization_type_ids" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "recipe_id" uuid;

-- Create dropshipping_providers table
CREATE TABLE IF NOT EXISTS "dropshipping_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_code" varchar(40) NOT NULL,
	"credentials_encrypted" text,
	"is_active" boolean DEFAULT true,
	"default_margin_percent" numeric(5, 2) DEFAULT '80.00' NOT NULL,
	"rounding_rule" varchar(20) DEFAULT 'none',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dropshipping_providers_unique_idx" ON "dropshipping_providers" ("tenant_id", "provider_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_providers_tenant_idx" ON "dropshipping_providers" ("tenant_id");

-- Create dropshipping_fx_rates table
CREATE TABLE IF NOT EXISTS "dropshipping_fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_date" varchar(10) NOT NULL,
	"currency_from" varchar(3) NOT NULL,
	"currency_to" varchar(3) NOT NULL,
	"rate" numeric(12, 6) NOT NULL,
	"source" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dropshipping_fx_rates_unique_idx" ON "dropshipping_fx_rates" ("rate_date", "currency_from", "currency_to");

-- Create dropshipping_sync_log table
CREATE TABLE IF NOT EXISTS "dropshipping_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid,
	"provider_code" varchar(40) NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"payload_request" jsonb DEFAULT '{}'::jsonb,
	"payload_response" jsonb DEFAULT '{}'::jsonb,
	"success" boolean NOT NULL,
	"error_code" varchar(60),
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_sync_log_tenant_idx" ON "dropshipping_sync_log" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_sync_log_order_idx" ON "dropshipping_sync_log" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_sync_log_event_idx" ON "dropshipping_sync_log" ("event_type");

-- Create dropshipping_order_tickets table
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
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_tickets_tenant_idx" ON "dropshipping_order_tickets" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_tickets_order_idx" ON "dropshipping_order_tickets" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dropshipping_tickets_status_idx" ON "dropshipping_order_tickets" ("status");

-- Foreign keys
DO $$ BEGIN
 ALTER TABLE "dropshipping_providers" ADD CONSTRAINT "dropshipping_providers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dropshipping_sync_log" ADD CONSTRAINT "dropshipping_sync_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dropshipping_sync_log" ADD CONSTRAINT "dropshipping_sync_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dropshipping_order_tickets" ADD CONSTRAINT "dropshipping_order_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dropshipping_order_tickets" ADD CONSTRAINT "dropshipping_order_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

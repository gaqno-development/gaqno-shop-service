# Fifia Doces → gaqno-shop-service Data Migration Map

> **Scope**: one-shot cutover of the `fifia_doces_web` Postgres (Prisma) into the multi-tenant `gaqno-shop-service` schema, tenant slug `fifia-doces`.
>
> **Source**: `postgresql://fifiadoces:***@postgres-generate-neural-transmitter-mjvb6w:5432/fifiadoces` (Dokploy project "Fifia Doces"). Source is a Prisma schema (`fifia_doces/prisma/schema.prisma`).
>
> **Target**: `gaqno-shop-db` (tenant `fifia-doces`, slug seeded by `seed-tenants.ts`, resolved via `domain = fifiadoces.com.br`).

## Domains

| Kind | Host | How tenant is resolved |
| ---- | ---- | ---------------------- |
| Public storefront | `fifiadoces.com.br` | `tenants.domain` column (exact match) |
| Admin panel | `fifiadoces.gaqno.com.br` | JWT `tenantId` claim or `x-tenant-slug: fifia-doces` header (not via `tenants.domain`, because it's `UNIQUE` and already taken by the public host) |

## Enum mapping

### `OrderStatus` (fifia) → `order_status` (target)

| Fifia | Target | Notes |
| ----- | ------ | ----- |
| `AWAITING_PAYMENT` | `pending` | |
| `PAID` | `confirmed` | |
| `AWAITING_DECORATION_REVIEW` | `awaiting_decoration_review` | 1:1 |
| `DECORATION_APPROVED` | `decoration_approved` | 1:1 |
| `PREPARING` | `processing` | |
| `READY` | `processing` | Ready-for-pickup/delivery is still pre-ship in target model |
| `OUT_FOR_DELIVERY` | `shipped` | |
| `COMPLETED` | `delivered` | |
| `CANCELLED` | `cancelled` | |

### `PaymentStatus` (fifia) → `payment_status` (target)

| Fifia | Target |
| ----- | ------ |
| `AWAITING_PAYMENT` | `pending` |
| `CONFIRMED` | `approved` |
| `REFUNDED` | `refunded` |

### `PaymentMethod` (fifia) → `payment_method` (target)

| Fifia | Target | Notes |
| ----- | ------ | ----- |
| `PIX` | `pix` | |
| `CHECKOUT_PRO` | `credit_card` | Closest match; Checkout Pro is a hosted card-flow wrapper. |

### `DecorationType` (fifia) → `bakery_decoration_type` (target)

| Fifia | Target |
| ----- | ------ |
| `TOPPING` | `topping` |
| `FILLING` | `filling` |
| `MESSAGE` | `message` |
| `THEME` | `theme` |
| `EXTRA` | `extra` |

> Note: the legacy `scripts/etl-fifia-doces.ts` uses `TOPPER / FLOWER / CUSTOM` which do **not** exist in the real Prisma schema. That code path is dead/wrong and must be corrected in the ETL rewrite.

### `CouponType` (fifia) → `coupons.type` (target varchar)

| Fifia | Target |
| ----- | ------ |
| `PERCENTAGE` | `percentage` |
| `FIXED` | `fixed` |

### `MovementType` (fifia) → `bakery_movement_type` (target)

| Fifia | Target |
| ----- | ------ |
| `IN` | `in` |
| `OUT` | `out` |
| `ADJUSTMENT` | `adjustment` |

### `EventType` (fifia) → `bakery_event_type` (target)

| Fifia | Target |
| ----- | ------ |
| `STOCK_PURCHASE` | `stock_purchase` |
| `PRODUCTION` | `production` |
| `DELIVERY` | `delivery` |
| `CUSTOM` | `custom` |

### `Role` (fifia)

- `CUSTOMER` → inserted into `customers`
- `ADMIN` → **skipped**. Admins will be re-invited via gaqno SSO; their rows do not carry over. Emails can be exported separately for re-invite.

## Table mapping

Every row written to the target stamps `tenant_id = <fifia-doces tenant UUID>`.

### Catalog

| Source (Prisma) | Target (Drizzle) | Transform notes |
| --------------- | ---------------- | --------------- |
| `Category` | `categories` | `name`, `slug`, `description`; `imageAssetId` → resolve `Asset.url` → rehost to R2 → `image_url` |
| `Product` | `products` | `basePrice` → `price`; `allowsReferenceImage` → same column; images aggregated into `products.images` jsonb array (URL list, in `ProductImage.order` order); `recipeId` mapped via id-map |
| `ProductImage` | merged into `products.images` jsonb | Flatten to array of URLs; each `Asset.url` rehosted to R2 first |
| `ProductSize` | `bakery_product_sizes` | Straight 1:1; `priceModifier`, `servings` preserved; `sortOrder = 0` if not provided |
| `Ingredient` | `bakery_ingredients` | Straight 1:1 including `stock`, `minStock`, `costPerUnit` (full current stock carries over) |
| `ProductIngredient` | `bakery_product_ingredients` | Straight 1:1 |
| `Recipe` | `bakery_recipes` | Straight 1:1 |
| `RecipeIngredient` | `bakery_recipe_ingredients` | Straight 1:1 |
| `Decoration` | `bakery_decorations` | `price` → same, `type` via enum map; `imageAssetId` → R2-rehosted URL → `image_url` |
| `ProductDecoration` | `bakery_product_decorations` | Straight 1:1 |
| `InventoryMovement` | `bakery_inventory_movements` | Full audit history migrated. `orderId` mapped via id-map (nullable if order wasn't migrated). |

### Customers

| Source | Target | Transform |
| ------ | ------ | --------- |
| `User (role=CUSTOMER)` | `customers` | `name` → `splitName(name)` → `{firstName, lastName}`; `email` copied; `phone` copied; `image` → `avatarUrl`; password hash copied only if present (bcrypt format compatible with our auth stack); `metadata = { source: "fifia_doces", source_id: <User.id> }` |
| `User (role=ADMIN)` | **skipped** | Re-invite via gaqno SSO after cutover |
| `Address` | `customer_addresses` | Fifia has `zipCode` → target `cep` (strip non-digits, format as `00000-000`); `street`, `number`, `complement`, `neighborhood`, `city`, `state` (coerce state to 2-char UF uppercase), `isDefault` copied |
| `Account` | **skipped** | NextAuth data; replaced by `customer_oauth_accounts` going forward |
| `Session` / `VerificationToken` | **skipped** | Transient auth data |

### Orders

| Source | Target | Transform |
| ------ | ------ | --------- |
| `Order` | `orders` | `userId` → `customerId` via id-map; status/payment enum maps; `subtotal`/`shippingCost → shippingAmount`/`discount → discountAmount`/`total` copied; `pixCode` → `pixQrCode`; `qrCodeBase64` → `pixQrCodeBase64`; `pixExpiresAt`, `paidAt` copied; `mpPaymentId` → `paymentExternalId`; `initPoint` → `paymentExternalUrl`; `preferenceId` preserved in `metadata`; `paymentProvider = "mercado_pago"` where `paymentMethod=CHECKOUT_PRO` or `pixCode IS NOT NULL`; `couponId` mapped via id-map; `deliveryType`/`deliveryDate`/`deliveryTime`/`deliveryAddressId` → `metadata.delivery`; addresses rebuilt into `shipping_address` jsonb from the referenced `Address` row; `orderNumber = "FIFIA-" + upper(last 8 of source id)` |
| `OrderItem` | `order_items` | `orderId`/`productId` via id-map; `quantity`/`unitPrice → price`/`totalPrice → total`; `size`, `notes`, `referenceImageUrl` copied; `name` = product name snapshot at migration time |
| `OrderItemDecoration` | `bakery_order_item_decorations` | Straight 1:1 |
| `OrderTimeline` | `order_status_history` | Each row inserted with mapped `status` enum, `createdAt` preserved, `note` → `notes` |
| `AdminEvent` | `bakery_admin_events` | Enum map; `date` → `date`, `endDate` → `end_date`; `orderId` via id-map |

### Coupons

| Source | Target | Transform |
| ------ | ------ | --------- |
| `Coupon` | `coupons` | `code`, `type` via enum map, `value`, `minOrder`, `maxUses`, `usedCount`, `validFrom`, `validUntil`, `isActive` copied 1:1 |

### Shipping

| Source | Target | Transform |
| ------ | ------ | --------- |
| `ShippingZone` | `shipping_methods` (one per zone) | `name` preserved; `slug = slugify(name)`; `carrier = "custom"`; `flatRate = fixedPrice`; `isActive` copied; `settings = { zipStart, zipEnd, pricePerKm }`. The shipping resolver service must be extended (separate task) to read `settings.zipStart`/`zipEnd`/`pricePerKm` for zip-range pricing — until then the method behaves as a flat-rate. |

### Site

| Source | Target | Transform |
| ------ | ------ | --------- |
| `SiteSettings` (singleton) | `bakery_site_settings` | Merge `introTitle` + `introText` → `intro_title` + `intro_text`; `heroImageId` → R2-rehosted → `hero_image_url`; `storeName`, `heroTitle`, `heroSubtitle`, `whatsappNumber`, `instagramUrl` → corresponding columns; upsert keyed on `tenant_id` |

## Assets & Images

Fifia's `Asset.url` points to **DatoCMS CDN**. Every image asset referenced by `Category`, `Product` (via `ProductImage`), `Decoration`, and `SiteSettings.heroImage` must be:

1. Downloaded from its DatoCMS URL.
2. Uploaded to our Cloudflare R2 bucket `gaqno-media` at key `fifiadoces/<sha256>.<ext>` (sha256 of URL for dedup — same DatoCMS asset shared by multiple records gets one R2 object).
3. The stored target URL is `https://media.gaqno.com.br/fifiadoces/<sha256>.<ext>`.

Already-migrated URLs (those on `media.gaqno.com.br`) must be detected and skipped.

## Idempotency

A dedicated target table `etl_id_map` records every migrated source row:

```sql
CREATE TABLE etl_id_map (
  source_table VARCHAR(100) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  migrated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_table, source_id, tenant_id)
);
```

Every ETL insert is preceded by a lookup in `etl_id_map` — if found, the insert is skipped and the existing `target_id` is used. Every successful insert records the mapping. Re-running the ETL is a no-op.

## Verification checklist (post-migration)

Run `scripts/verify-fifia-migration.ts` which asserts:

- `count(products WHERE tenant_id=fifia)` == `count(Product)` in source
- `count(customers WHERE tenant_id=fifia)` == `count(User WHERE role=CUSTOMER)` in source
- `count(orders WHERE tenant_id=fifia)` == `count(Order)` in source
- `count(coupons WHERE tenant_id=fifia)` == `count(Coupon)` in source
- `sum(orders.total WHERE tenant_id=fifia)` == `sum(Order.total)` in source (cents-exact)
- Every `orders.customer_id` resolves to a row in `customers` (no orphans)
- Every `order_items.order_id` resolves to `orders` (no orphans)
- Every `order_items.product_id` resolves to `products` (null allowed if source had a deleted product)

The script exits non-zero on any failure; the cutover is aborted if verification fails.

## Known schema drift (must fix before ETL run)

1. **`order_status` enum** in prod lacks `awaiting_decoration_review` and `decoration_approved` (both present in Drizzle schema but missing from `createEnums` / no ALTER migration step).
   - Fix: add a new migration step `applyOrderStatusEnumValues.ts` that runs `ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_decoration_review'` and similarly for `decoration_approved`, wired into `migrate.ts` **before any enum-typed inserts**.
   - Without this, mapping `AWAITING_DECORATION_REVIEW`/`DECORATION_APPROVED` to their target enum values will error.
2. **`etl_id_map` table** does not yet exist — needs its own migration step.

## Cutover sequence

1. Put `fifia_doces_web` in maintenance mode (set a `MAINTENANCE_MODE=1` env or stop accepting writes).
2. Run `scripts/fifia/run-etl.ts` (full, not dry).
3. Run `scripts/verify-fifia-migration.ts`.
4. Re-run `scripts/fifia/run-etl.ts` once more; must report 0 new rows (idempotency check).
5. Swap `fifiadoces.com.br` DNS / Dokploy routing from `fifia_doces_web` (port 3000) to the gaqno consumer-ui → gaqno-shop-service stack.
6. Ensure `fifiadoces.gaqno.com.br` admin routes land on `gaqno-shop-admin` → `gaqno-shop-service`.
7. Smoke-test: login as a known fifia customer, verify order history visible; add-to-cart → checkout → payment on new stack.
8. Stop `fifia_doces_web` Dokploy app. Keep `fifia-pg` database volume for **30 days minimum** as recovery fallback.

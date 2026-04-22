import * as dotenv from "dotenv";
import * as path from "path";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { createIdMap } from "./fifia/id-map";
import type { IdMap } from "./fifia/id-map";

function createInMemoryIdMap(): IdMap {
  const m = new Map<string, string>();
  return {
    async lookup(table, id) {
      return m.get(`${table}:${id}`) ?? null;
    },
    async remember(table, id, target) {
      m.set(`${table}:${id}`, target);
    },
    async ensure(table, id, factory) {
      const key = `${table}:${id}`;
      const cached = m.get(key);
      if (cached) return cached;
      const next = await factory();
      m.set(key, next);
      return next;
    },
  };
}
import { createImageRehoster } from "./fifia/image-rehost";
import type { ImageRehoster } from "./fifia/image-rehost";
import {
  mapOrderStatus,
  mapPaymentStatus,
  mapPaymentMethod,
  mapDecorationType,
  mapCouponType,
  mapMovementType,
  mapAdminEventType,
} from "./fifia/mappers/enum-maps";
import {
  splitName,
  normalizeCep,
  normalizeUf,
  fifiaOrderNumber,
} from "./fifia/mappers/customer-maps";
import { zoneToShippingMethod } from "./fifia/mappers/shipping-maps";

dotenv.config({ path: path.join(__dirname, "../.env") });

const SRC_URL = process.env.FIFIA_DATABASE_URL;
const DST_URL = process.env.DATABASE_URL;
const TENANT_SLUG = process.env.FIFIA_TENANT_SLUG ?? "fifia-doces";
const DRY_RUN = process.env.ETL_DRY_RUN === "1";
const SKIP_IMAGES = process.env.ETL_SKIP_IMAGES === "1";

const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "https://cdn.gaqno.com.br";

if (!SRC_URL || !DST_URL) {
  console.error("Missing FIFIA_DATABASE_URL (source) and/or DATABASE_URL (target).");
  process.exit(1);
}

const src = new Pool({ connectionString: SRC_URL, max: 2 });
const dst = new Pool({ connectionString: DST_URL, max: 2 });

interface EtlContext {
  tenantId: string;
  tenantSlug: string;
  idMap: IdMap;
  imageRehoster: ImageRehoster;
}

function ensureR2Uploader(): ImageRehoster {
  if (SKIP_IMAGES) {
    return createImageRehoster({
      tenantSlug: TENANT_SLUG,
      publicBase: R2_PUBLIC_URL,
      lookup: async () => null,
      remember: async () => undefined,
      fetcher: async (url) => ({
        bytes: Buffer.alloc(0),
        contentType: "image/jpeg",
        sourceUrl: url,
      }),
      uploader: async () => undefined,
    });
  }

  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ENDPOINT || !R2_BUCKET) {
    throw new Error(
      "R2 credentials missing (need R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT, R2_BUCKET).",
    );
  }
  const s3 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });
  const memory = new Map<string, string>();
  return createImageRehoster({
    tenantSlug: TENANT_SLUG,
    publicBase: R2_PUBLIC_URL,
    lookup: async (src) => memory.get(src) ?? null,
    remember: async (src, url) => {
      memory.set(src, url);
    },
    fetcher: async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Fetch failed ${res.status} for ${url}`);
      }
      const ab = await res.arrayBuffer();
      return {
        bytes: Buffer.from(ab),
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
        sourceUrl: url,
      };
    },
    uploader: async (key, bytes, contentType) => {
      if (DRY_RUN) return;
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
  });
}

async function resolveTenantId(client: PoolClient): Promise<string> {
  const res = await client.query(
    `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
    [TENANT_SLUG],
  );
  if (!res.rows[0]) {
    throw new Error(`Tenant '${TENANT_SLUG}' not found. Run npm run provision:fifia first.`);
  }
  return String(res.rows[0].id);
}

interface InsertResult {
  id: string;
}

async function safeRehost(
  rehoster: ImageRehoster,
  input: {
    entity: "product" | "category" | "decoration" | "hero" | "asset";
    sourceId: string;
    url: string;
  },
): Promise<string | null> {
  try {
    return await rehoster.rehost(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[rehost] skipped ${input.entity}/${input.sourceId}: ${msg}`);
    return null;
  }
}

async function insertReturningId(
  client: PoolClient,
  sql: string,
  values: readonly unknown[],
): Promise<string> {
  if (DRY_RUN) {
    console.log(`[DRY] ${sql.split("\n")[0].trim()} values=${values.length}`);
    return randomUUID();
  }
  const res = await client.query<InsertResult>(sql, values as unknown[]);
  if (!res.rows[0]) {
    throw new Error(`Insert did not return id: ${sql}`);
  }
  return String(res.rows[0].id);
}

async function migrateCategories(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT c.id, c.name, c.slug, c.description, c."createdAt", c."updatedAt",
            a.url AS image_url
       FROM "Category" c
       LEFT JOIN "Asset" a ON a.id = c."imageAssetId"
       ORDER BY c."createdAt"`,
  );
  console.log(`[categories] ${rows.length}`);
  for (const c of rows) {
    await ctx.idMap.ensure("Category", c.id, async () => {
      const imageUrl = c.image_url
        ? await safeRehost(ctx.imageRehoster, {
            entity: "category",
            sourceId: c.id,
            url: c.image_url,
          })
        : null;
      return insertReturningId(
        d,
        `INSERT INTO categories
           (tenant_id, name, slug, description, image_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7)
         RETURNING id`,
        [ctx.tenantId, c.name, c.slug, c.description, imageUrl, c.createdAt, c.updatedAt],
      );
    });
  }
}

async function migrateIngredients(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, name, unit, "gramsPerUnit", stock, "minStock", "costPerUnit",
            "createdAt", "updatedAt"
       FROM "Ingredient"`,
  );
  console.log(`[ingredients] ${rows.length}`);
  for (const i of rows) {
    await ctx.idMap.ensure("Ingredient", i.id, () =>
      insertReturningId(
        d,
        `INSERT INTO bakery_ingredients
           (tenant_id, name, unit, grams_per_unit, stock, min_stock, cost_per_unit,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (tenant_id, name) DO UPDATE SET
           unit = EXCLUDED.unit,
           grams_per_unit = EXCLUDED.grams_per_unit,
           stock = EXCLUDED.stock,
           min_stock = EXCLUDED.min_stock,
           cost_per_unit = EXCLUDED.cost_per_unit,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          ctx.tenantId,
          i.name,
          i.unit,
          i.gramsPerUnit,
          i.stock,
          i.minStock,
          i.costPerUnit,
          i.createdAt,
          i.updatedAt,
        ],
      ),
    );
  }
}

async function migrateRecipes(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, name, description, "yieldQuantity", "yieldUnit",
            "laborCost", "overheadCost", "profitMarginPercent",
            "createdAt", "updatedAt"
       FROM "Recipe"`,
  );
  console.log(`[recipes] ${rows.length}`);
  for (const r of rows) {
    await ctx.idMap.ensure("Recipe", r.id, () =>
      insertReturningId(
        d,
        `INSERT INTO bakery_recipes
           (tenant_id, name, description, yield_quantity, yield_unit,
            labor_cost, overhead_cost, profit_margin_percent,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          ctx.tenantId,
          r.name,
          r.description,
          r.yieldQuantity,
          r.yieldUnit,
          r.laborCost,
          r.overheadCost,
          r.profitMarginPercent,
          r.createdAt,
          r.updatedAt,
        ],
      ),
    );
  }

  const { rows: links } = await s.query(
    `SELECT id, "recipeId", "ingredientId", quantity FROM "RecipeIngredient"`,
  );
  for (const l of links) {
    await ctx.idMap.ensure("RecipeIngredient", l.id, async () => {
      const recipeId = await ctx.idMap.lookup("Recipe", l.recipeId);
      const ingredientId = await ctx.idMap.lookup("Ingredient", l.ingredientId);
      if (!recipeId || !ingredientId) {
        throw new Error(
          `RecipeIngredient missing refs: recipe=${l.recipeId} ing=${l.ingredientId}`,
        );
      }
      return insertReturningId(
        d,
        `INSERT INTO bakery_recipe_ingredients
           (tenant_id, recipe_id, ingredient_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET
           quantity = EXCLUDED.quantity
         RETURNING id`,
        [ctx.tenantId, recipeId, ingredientId, l.quantity],
      );
    });
  }
}

async function migrateDecorations(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT dec.id, dec.name, dec.description, dec.price, dec.type, dec."isActive",
            dec."createdAt", dec."updatedAt",
            a.url AS image_url
       FROM "Decoration" dec
       LEFT JOIN "Asset" a ON a.id = dec."imageAssetId"`,
  );
  console.log(`[decorations] ${rows.length}`);
  for (const row of rows) {
    await ctx.idMap.ensure("Decoration", row.id, async () => {
      const imageUrl = row.image_url
        ? await safeRehost(ctx.imageRehoster, {
            entity: "decoration",
            sourceId: row.id,
            url: row.image_url,
          })
        : null;
      return insertReturningId(
        d,
        `INSERT INTO bakery_decorations
           (tenant_id, name, description, price, type, image_url, is_active,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::bakery_decoration_type, $6, $7, $8, $9)
         RETURNING id`,
        [
          ctx.tenantId,
          row.name,
          row.description,
          row.price,
          mapDecorationType(String(row.type)),
          imageUrl,
          row.isActive,
          row.createdAt,
          row.updatedAt,
        ],
      );
    });
  }
}

async function migrateProducts(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, name, slug, description, "basePrice", "categoryId", "recipeId",
            "isActive", "allowsReferenceImage", "createdAt", "updatedAt"
       FROM "Product"`,
  );
  console.log(`[products] ${rows.length}`);
  for (const p of rows) {
    await ctx.idMap.ensure("Product", p.id, async () => {
      const categoryId = await ctx.idMap.lookup("Category", p.categoryId);
      const recipeId = p.recipeId
        ? await ctx.idMap.lookup("Recipe", p.recipeId)
        : null;
      if (!categoryId) {
        throw new Error(`Product ${p.id} has missing category ${p.categoryId}`);
      }
      return insertReturningId(
        d,
        `INSERT INTO products
           (tenant_id, category_id, name, slug, description, price,
            is_active, allows_reference_image, recipe_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          ctx.tenantId,
          categoryId,
          p.name,
          p.slug,
          p.description,
          p.basePrice,
          p.isActive,
          p.allowsReferenceImage,
          recipeId,
          p.createdAt,
          p.updatedAt,
        ],
      );
    });
  }

  const { rows: images } = await s.query(
    `SELECT pi.id, pi."productId", pi."order", a.id AS asset_id, a.url
       FROM "ProductImage" pi
       JOIN "Asset" a ON a.id = pi."assetId"
       ORDER BY pi."productId", pi."order"`,
  );

  const imagesByProduct = new Map<string, string[]>();
  for (const img of images) {
    const productId = await ctx.idMap.lookup("Product", img.productId);
    if (!productId) continue;
    const rehosted = await safeRehost(ctx.imageRehoster, {
      entity: "product",
      sourceId: img.asset_id,
      url: img.url,
    });
    if (!rehosted) continue;
    const arr = imagesByProduct.get(productId) ?? [];
    arr.push(rehosted);
    imagesByProduct.set(productId, arr);
  }
  for (const [productId, urls] of imagesByProduct) {
    if (DRY_RUN) {
      console.log(`[DRY] update product ${productId} images`, urls.length);
      continue;
    }
    await d.query(
      `UPDATE products SET images = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(urls), productId],
    );
  }

  const { rows: sizes } = await s.query(
    `SELECT id, "productId", name, "priceModifier", servings FROM "ProductSize"`,
  );
  for (const sz of sizes) {
    await ctx.idMap.ensure("ProductSize", sz.id, async () => {
      const productId = await ctx.idMap.lookup("Product", sz.productId);
      if (!productId) throw new Error(`ProductSize missing product ${sz.productId}`);
      return insertReturningId(
        d,
        `INSERT INTO bakery_product_sizes
           (tenant_id, product_id, name, price_modifier, servings)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [ctx.tenantId, productId, sz.name, sz.priceModifier, sz.servings],
      );
    });
  }

  const { rows: pIng } = await s.query(
    `SELECT id, "productId", "ingredientId", quantity FROM "ProductIngredient"`,
  );
  for (const pi of pIng) {
    await ctx.idMap.ensure("ProductIngredient", pi.id, async () => {
      const productId = await ctx.idMap.lookup("Product", pi.productId);
      const ingredientId = await ctx.idMap.lookup("Ingredient", pi.ingredientId);
      if (!productId || !ingredientId) {
        throw new Error(
          `ProductIngredient missing refs p=${pi.productId} ing=${pi.ingredientId}`,
        );
      }
      return insertReturningId(
        d,
        `INSERT INTO bakery_product_ingredients
           (tenant_id, product_id, ingredient_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (product_id, ingredient_id) DO UPDATE SET
           quantity = EXCLUDED.quantity
         RETURNING id`,
        [ctx.tenantId, productId, ingredientId, pi.quantity],
      );
    });
  }

  const { rows: pDec } = await s.query(
    `SELECT id, "productId", "decorationId" FROM "ProductDecoration"`,
  );
  for (const pd of pDec) {
    await ctx.idMap.ensure("ProductDecoration", pd.id, async () => {
      const productId = await ctx.idMap.lookup("Product", pd.productId);
      const decorationId = await ctx.idMap.lookup("Decoration", pd.decorationId);
      if (!productId || !decorationId) {
        throw new Error(
          `ProductDecoration missing refs p=${pd.productId} dec=${pd.decorationId}`,
        );
      }
      return insertReturningId(
        d,
        `INSERT INTO bakery_product_decorations
           (tenant_id, product_id, decoration_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, decoration_id) DO NOTHING
         RETURNING id`,
        [ctx.tenantId, productId, decorationId],
      ).catch(async () => {
        const existing = await d.query(
          `SELECT id FROM bakery_product_decorations
             WHERE product_id = $1 AND decoration_id = $2 LIMIT 1`,
          [productId, decorationId],
        );
        return String(existing.rows[0]?.id);
      });
    });
  }
}

async function migrateCoupons(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, code, type, value, "minOrder", "maxUses", "usedCount",
            "validFrom", "validUntil", "isActive", "createdAt", "updatedAt"
       FROM "Coupon"`,
  );
  console.log(`[coupons] ${rows.length}`);
  for (const c of rows) {
    await ctx.idMap.ensure("Coupon", c.id, () =>
      insertReturningId(
        d,
        `INSERT INTO coupons
           (tenant_id, code, type, value, min_order, max_uses, used_count,
            valid_from, valid_until, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (tenant_id, code) DO UPDATE SET
           type = EXCLUDED.type,
           value = EXCLUDED.value,
           min_order = EXCLUDED.min_order,
           max_uses = EXCLUDED.max_uses,
           used_count = EXCLUDED.used_count,
           valid_from = EXCLUDED.valid_from,
           valid_until = EXCLUDED.valid_until,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          ctx.tenantId,
          c.code,
          mapCouponType(String(c.type)),
          c.value,
          c.minOrder,
          c.maxUses,
          c.usedCount,
          c.validFrom,
          c.validUntil,
          c.isActive,
          c.createdAt,
          c.updatedAt,
        ],
      ),
    );
  }
}

async function migrateShippingMethods(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, name, "zipStart", "zipEnd", "fixedPrice", "pricePerKm",
            "isActive", "createdAt", "updatedAt"
       FROM "ShippingZone"`,
  );
  console.log(`[shipping_methods] ${rows.length}`);
  for (const z of rows) {
    await ctx.idMap.ensure("ShippingZone", z.id, async () => {
      const draft = zoneToShippingMethod({
        id: z.id,
        name: z.name,
        zipStart: z.zipStart,
        zipEnd: z.zipEnd,
        fixedPrice: z.fixedPrice,
        pricePerKm: z.pricePerKm,
        isActive: z.isActive,
      });
      return insertReturningId(
        d,
        `INSERT INTO shipping_methods
           (tenant_id, name, slug, carrier, is_active, flat_rate, handling_days,
            settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         ON CONFLICT (tenant_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           is_active = EXCLUDED.is_active,
           flat_rate = EXCLUDED.flat_rate,
           settings = EXCLUDED.settings,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          ctx.tenantId,
          draft.name,
          draft.slug,
          draft.carrier,
          draft.is_active,
          draft.flat_rate,
          draft.handling_days,
          JSON.stringify(draft.settings),
          z.createdAt,
          z.updatedAt,
        ],
      );
    });
  }
}

async function migrateCustomers(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, email, name, phone, role, "createdAt", "updatedAt"
       FROM "User"`,
  );
  console.log(`[customers] ${rows.length}`);
  for (const u of rows) {
    await ctx.idMap.ensure("User", u.id, () => {
      const { firstName, lastName } = splitName(u.name);
      return insertReturningId(
        d,
        `INSERT INTO customers
           (tenant_id, email, first_name, last_name, phone, is_active, metadata,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, $7, $8)
         ON CONFLICT (tenant_id, email) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           phone = EXCLUDED.phone,
           metadata = customers.metadata || EXCLUDED.metadata,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          ctx.tenantId,
          u.email,
          firstName,
          lastName,
          u.phone,
          JSON.stringify({
            source: "fifia_doces",
            source_id: u.id,
            role: u.role,
          }),
          u.createdAt,
          u.updatedAt,
        ],
      );
    });
  }
}

async function migrateAddresses(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, "userId", street, number, complement, neighborhood, city, state,
            "zipCode", "isDefault", "createdAt", "updatedAt"
       FROM "Address"`,
  );
  console.log(`[customer_addresses] ${rows.length}`);
  for (const a of rows) {
    await ctx.idMap.ensure("Address", a.id, async () => {
      const customerId = await ctx.idMap.lookup("User", a.userId);
      if (!customerId) throw new Error(`Address missing user ${a.userId}`);
      return insertReturningId(
        d,
        `INSERT INTO customer_addresses
           (tenant_id, customer_id, cep, street, number, complement, neighborhood,
            city, state, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          ctx.tenantId,
          customerId,
          normalizeCep(a.zipCode),
          a.street,
          a.number,
          a.complement,
          a.neighborhood,
          a.city,
          normalizeUf(a.state),
          a.isDefault,
          a.createdAt,
          a.updatedAt,
        ],
      );
    });
  }
}

async function buildShippingAddressJson(
  s: PoolClient,
  addressId: string | null,
): Promise<Record<string, unknown>> {
  if (!addressId) return {};
  const res = await s.query(
    `SELECT street, number, complement, neighborhood, city, state, "zipCode"
       FROM "Address" WHERE id = $1 LIMIT 1`,
    [addressId],
  );
  const a = res.rows[0];
  if (!a) return {};
  return {
    street: a.street,
    number: a.number,
    complement: a.complement,
    neighborhood: a.neighborhood,
    city: a.city,
    state: normalizeUf(a.state),
    cep: normalizeCep(a.zipCode),
  };
}

async function migrateOrders(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, "userId", status, "paymentStatus", "paymentMethod",
            subtotal, "shippingCost", discount, total,
            "deliveryType", "deliveryDate", "deliveryTime", "deliveryAddressId",
            notes, "couponId", "mpPaymentId", "preferenceId", "initPoint",
            "pixCode", "pixExpiresAt", "paidAt", "qrCodeBase64",
            "createdAt", "updatedAt"
       FROM "Order"
       ORDER BY "createdAt"`,
  );
  console.log(`[orders] ${rows.length}`);
  for (const o of rows) {
    await ctx.idMap.ensure("Order", o.id, async () => {
      const customerId = await ctx.idMap.lookup("User", o.userId);
      if (!customerId) throw new Error(`Order ${o.id} missing customer ${o.userId}`);
      const shippingAddress = await buildShippingAddressJson(s, o.deliveryAddressId);
      const metadata = {
        source: "fifia_doces",
        source_id: o.id,
        deliveryType: o.deliveryType,
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime,
        mpPaymentId: o.mpPaymentId,
        preferenceId: o.preferenceId,
        initPoint: o.initPoint,
        pixCode: o.pixCode,
        pixExpiresAt: o.pixExpiresAt,
        qrCodeBase64: o.qrCodeBase64 ? true : false,
      };
      const status = mapOrderStatus(String(o.status));
      const paymentStatus = mapPaymentStatus(String(o.paymentStatus));
      const paymentMethod = mapPaymentMethod(String(o.paymentMethod));
      return insertReturningId(
        d,
        `INSERT INTO orders
           (tenant_id, customer_id, order_number, status, payment_status,
            payment_method, payment_external_id, payment_external_url,
            pix_qr_code, pix_qr_code_base64, pix_expires_at,
            subtotal, discount_amount, shipping_amount, total, currency,
            notes, shipping_address, metadata, paid_at,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4::order_status, $5::payment_status,
                 $6::payment_method, $7, $8,
                 $9, $10, $11,
                 $12, $13, $14, $15, 'BRL',
                 $16, $17::jsonb, $18::jsonb, $19,
                 $20, $21)
         ON CONFLICT (tenant_id, order_number) DO UPDATE SET
           status = EXCLUDED.status,
           payment_status = EXCLUDED.payment_status,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          ctx.tenantId,
          customerId,
          fifiaOrderNumber(o.id),
          status,
          paymentStatus,
          paymentMethod,
          o.mpPaymentId,
          o.initPoint,
          o.pixCode,
          o.qrCodeBase64,
          o.pixExpiresAt,
          o.subtotal,
          o.discount,
          o.shippingCost,
          o.total,
          o.notes,
          JSON.stringify(shippingAddress),
          JSON.stringify(metadata),
          o.paidAt,
          o.createdAt,
          o.updatedAt,
        ],
      );
    });
  }

  const { rows: items } = await s.query(
    `SELECT oi.id, oi."orderId", oi."productId", oi.quantity, oi.size,
            oi."unitPrice", oi."totalPrice", oi.notes, oi."referenceImageUrl",
            p.name AS product_name
       FROM "OrderItem" oi
       LEFT JOIN "Product" p ON p.id = oi."productId"`,
  );
  console.log(`[order_items] ${items.length}`);
  for (const it of items) {
    await ctx.idMap.ensure("OrderItem", it.id, async () => {
      const orderId = await ctx.idMap.lookup("Order", it.orderId);
      if (!orderId) throw new Error(`OrderItem missing order ${it.orderId}`);
      const productId = it.productId
        ? await ctx.idMap.lookup("Product", it.productId)
        : null;
      const rehostedRef = it.referenceImageUrl
        ? await safeRehost(ctx.imageRehoster, {
            entity: "product",
            sourceId: `oi-ref-${it.id}`,
            url: it.referenceImageUrl,
          })
        : null;
      return insertReturningId(
        d,
        `INSERT INTO order_items
           (tenant_id, order_id, product_id, name, quantity, price, total,
            size, notes, reference_image_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          ctx.tenantId,
          orderId,
          productId,
          it.product_name ?? "Produto removido",
          it.quantity,
          it.unitPrice,
          it.totalPrice,
          it.size,
          it.notes,
          rehostedRef,
        ],
      );
    });
  }

  const { rows: itemDecs } = await s.query(
    `SELECT id, "orderItemId", "decorationId", "customText", price
       FROM "OrderItemDecoration"`,
  );
  console.log(`[order_item_decorations] ${itemDecs.length}`);
  for (const di of itemDecs) {
    await ctx.idMap.ensure("OrderItemDecoration", di.id, async () => {
      const orderItemId = await ctx.idMap.lookup("OrderItem", di.orderItemId);
      const decorationId = await ctx.idMap.lookup("Decoration", di.decorationId);
      if (!orderItemId || !decorationId) {
        throw new Error(
          `OrderItemDecoration missing refs item=${di.orderItemId} dec=${di.decorationId}`,
        );
      }
      return insertReturningId(
        d,
        `INSERT INTO bakery_order_item_decorations
           (tenant_id, order_item_id, decoration_id, custom_text, price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [ctx.tenantId, orderItemId, decorationId, di.customText, di.price],
      );
    });
  }

  const { rows: timeline } = await s.query(
    `SELECT id, "orderId", status, note, "createdAt"
       FROM "OrderTimeline"
       ORDER BY "createdAt"`,
  );
  console.log(`[order_status_history] ${timeline.length}`);
  for (const t of timeline) {
    await ctx.idMap.ensure("OrderTimeline", t.id, async () => {
      const orderId = await ctx.idMap.lookup("Order", t.orderId);
      if (!orderId) throw new Error(`OrderTimeline missing order ${t.orderId}`);
      return insertReturningId(
        d,
        `INSERT INTO order_status_history
           (tenant_id, order_id, status, notes, created_at)
         VALUES ($1, $2, $3::order_status, $4, $5)
         RETURNING id`,
        [ctx.tenantId, orderId, mapOrderStatus(String(t.status)), t.note, t.createdAt],
      );
    });
  }
}

async function migrateInventoryMovements(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, "ingredientId", type, quantity, reason, "orderId", "createdAt"
       FROM "InventoryMovement"
       ORDER BY "createdAt"`,
  );
  console.log(`[inventory_movements] ${rows.length}`);
  for (const m of rows) {
    await ctx.idMap.ensure("InventoryMovement", m.id, async () => {
      const ingredientId = await ctx.idMap.lookup("Ingredient", m.ingredientId);
      if (!ingredientId) {
        throw new Error(`InventoryMovement missing ingredient ${m.ingredientId}`);
      }
      const orderId = m.orderId
        ? await ctx.idMap.lookup("Order", m.orderId)
        : null;
      return insertReturningId(
        d,
        `INSERT INTO bakery_inventory_movements
           (tenant_id, ingredient_id, type, quantity, reason, order_id, created_at)
         VALUES ($1, $2, $3::bakery_movement_type, $4, $5, $6, $7)
         RETURNING id`,
        [
          ctx.tenantId,
          ingredientId,
          mapMovementType(String(m.type)),
          m.quantity,
          m.reason,
          orderId,
          m.createdAt,
        ],
      );
    });
  }
}

async function migrateAdminEvents(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT id, title, description, type, date, "endDate", "allDay", color,
            completed, "orderId", "createdAt", "updatedAt"
       FROM "AdminEvent"`,
  );
  console.log(`[admin_events] ${rows.length}`);
  for (const e of rows) {
    await ctx.idMap.ensure("AdminEvent", e.id, async () => {
      const orderId = e.orderId
        ? await ctx.idMap.lookup("Order", e.orderId)
        : null;
      return insertReturningId(
        d,
        `INSERT INTO bakery_admin_events
           (tenant_id, title, description, type, date, end_date, all_day, color,
            completed, order_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4::bakery_event_type, $5, $6, $7, $8,
                 $9, $10, $11, $12)
         RETURNING id`,
        [
          ctx.tenantId,
          e.title,
          e.description,
          mapAdminEventType(String(e.type)),
          e.date,
          e.endDate,
          e.allDay,
          e.color,
          e.completed,
          orderId,
          e.createdAt,
          e.updatedAt,
        ],
      );
    });
  }
}

async function migrateSiteSettings(
  s: PoolClient,
  d: PoolClient,
  ctx: EtlContext,
): Promise<void> {
  const { rows } = await s.query(
    `SELECT s."storeName", s."paymentDescriptor", s."heroTitle", s."heroSubtitle",
            s."introTitle", s."introText", s."whatsappNumber", s."instagramUrl",
            s."updatedAt", a.id AS hero_asset_id, a.url AS hero_image_url
       FROM "SiteSettings" s
       LEFT JOIN "Asset" a ON a.id = s."heroImageId"
       LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return;
  console.log(`[site_settings] 1`);
  const heroUrl = row.hero_image_url
    ? await safeRehost(ctx.imageRehoster, {
        entity: "asset",
        sourceId: row.hero_asset_id ?? "hero",
        url: row.hero_image_url,
      })
    : null;
  if (DRY_RUN) return;
  await d.query(
    `INSERT INTO bakery_site_settings
       (tenant_id, store_name, payment_descriptor, hero_title, hero_subtitle,
        hero_image_url, intro_title, intro_text, whatsapp_number, instagram_url,
        updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id) DO UPDATE SET
       store_name = EXCLUDED.store_name,
       payment_descriptor = EXCLUDED.payment_descriptor,
       hero_title = EXCLUDED.hero_title,
       hero_subtitle = EXCLUDED.hero_subtitle,
       hero_image_url = EXCLUDED.hero_image_url,
       intro_title = EXCLUDED.intro_title,
       intro_text = EXCLUDED.intro_text,
       whatsapp_number = EXCLUDED.whatsapp_number,
       instagram_url = EXCLUDED.instagram_url,
       updated_at = EXCLUDED.updated_at`,
    [
      ctx.tenantId,
      row.storeName ?? "",
      row.paymentDescriptor ?? "",
      row.heroTitle ?? "",
      row.heroSubtitle ?? "",
      heroUrl,
      row.introTitle ?? "",
      row.introText ?? "",
      row.whatsappNumber ?? "",
      row.instagramUrl ?? "",
      row.updatedAt,
    ],
  );
}

async function run(): Promise<void> {
  console.log(
    `ETL Fifia Doces → gaqno-shop-service (dry=${DRY_RUN} skipImages=${SKIP_IMAGES})`,
  );
  const s = await src.connect();
  const d = await dst.connect();
  try {
    const tenantId = await resolveTenantId(d);
    const idMap = DRY_RUN ? createInMemoryIdMap() : createIdMap(d, tenantId);
    const imageRehoster = ensureR2Uploader();
    const ctx: EtlContext = {
      tenantId,
      tenantSlug: TENANT_SLUG,
      idMap,
      imageRehoster,
    };

    await migrateCategories(s, d, ctx);
    await migrateIngredients(s, d, ctx);
    await migrateRecipes(s, d, ctx);
    await migrateDecorations(s, d, ctx);
    await migrateProducts(s, d, ctx);
    await migrateCoupons(s, d, ctx);
    await migrateShippingMethods(s, d, ctx);
    await migrateCustomers(s, d, ctx);
    await migrateAddresses(s, d, ctx);
    await migrateOrders(s, d, ctx);
    await migrateInventoryMovements(s, d, ctx);
    await migrateAdminEvents(s, d, ctx);
    await migrateSiteSettings(s, d, ctx);

    console.log("\n[ETL] done");
  } finally {
    s.release();
    d.release();
    await src.end();
    await dst.end();
  }
}

run().catch((err) => {
  console.error("[ETL] failed:", err);
  process.exit(1);
});

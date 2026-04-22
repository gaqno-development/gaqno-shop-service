import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  customers,
  orders,
  tenantFeatureFlags,
  tenants,
} from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { presetForVertical } from "../common/vertical.constants";
import {
  SsoTenantClient,
  type SsoPublicOrgProjection,
} from "../common/sso-tenant-client";
import {
  TENANT_FEATURE_FLAG_KEYS,
  UpdateTenantFeatureFlagsDto,
} from "./dto/update-tenant-feature-flags.dto";

export interface ITenantSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly logoUrl: string | null;
  readonly ordersCount30d: number;
  readonly revenue30d: number;
  readonly customersCount: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PAID_PAYMENT_STATUSES = ["approved", "authorized"] as const;

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    @Optional() private readonly ssoClient?: SsoTenantClient,
  ) {}

  async ensureTenantExists(tenantId: string) {
    const existing = await this.getById(tenantId);
    if (existing) return existing;

    if (this.ssoClient) {
      try {
        const projection = await this.ssoClient.getById(tenantId);
        if (projection) {
          const upserted = await this.upsertFromSso(projection);
          if (upserted) return upserted;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to lazy-sync tenant ${tenantId} from SSO: ${(error as Error).message}`,
        );
      }
    }

    throw new NotFoundException(`Tenant ${tenantId} not found`);
  }

  async upsertFromSso(projection: SsoPublicOrgProjection) {
    if (!projection.slug) {
      this.logger.warn(
        `Cannot sync SSO tenant ${projection.id}: no slug provided`,
      );
      return null;
    }
    const existing = await this.getBySlug(projection.slug);
    if (existing) {
      return existing;
    }
    const [created] = await this.db
      .insert(tenants)
      .values({
        id: projection.id,
        slug: projection.slug,
        name: projection.name,
        vertical: projection.vertical ?? "generic",
        isActive: true,
      })
      .returning();
    this.logger.log(
      `Synced SSO tenant ${projection.id} (slug=${projection.slug}) into shop DB`,
    );
    return created;
  }

  resolve(domain: string) {
    return this.db.query.tenants.findFirst({
      where: eq(tenants.domain, domain),
    });
  }

  getBySlug(slug: string) {
    return this.db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
  }

  getById(id: string) {
    return this.db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  }

  listActive() {
    return this.db.query.tenants.findMany({
      where: eq(tenants.isActive, true),
      orderBy: [asc(tenants.name)],
    });
  }

  async listActiveWithSummary(): Promise<ITenantSummaryRow[]> {
    const activeTenants = await this.db.query.tenants.findMany({
      where: eq(tenants.isActive, true),
      orderBy: [asc(tenants.name)],
    });

    if (!activeTenants.length) return [];

    const tenantIds = activeTenants.map((t) => t.id);
    const since = new Date(Date.now() - THIRTY_DAYS_MS);

    const orderAggregates = (await this.db
      .select({
        tenantId: orders.tenantId,
        ordersCount30d: sql<string>`count(*)`.as("orders_count_30d"),
        revenue30d: sql<string>`coalesce(sum(${orders.total}), 0)`.as(
          "revenue_30d",
        ),
      })
      .from(orders)
      .where(
        and(
          inArray(orders.tenantId, tenantIds),
          inArray(orders.paymentStatus, [...PAID_PAYMENT_STATUSES]),
          gte(orders.createdAt, since),
        ),
      )
      .groupBy(orders.tenantId)) as Array<{
      tenantId: string;
      ordersCount30d: string | number;
      revenue30d: string | number | null;
    }>;

    const customerAggregates = (await this.db
      .select({
        tenantId: customers.tenantId,
        customersCount: sql<string>`count(*)`.as("customers_count"),
      })
      .from(customers)
      .where(inArray(customers.tenantId, tenantIds))
      .groupBy(customers.tenantId)) as Array<{
      tenantId: string;
      customersCount: string | number;
    }>;

    const orderMap = new Map(
      orderAggregates.map((row) => [
        row.tenantId,
        {
          ordersCount30d: Number(row.ordersCount30d ?? 0) || 0,
          revenue30d: Number(row.revenue30d ?? 0) || 0,
        },
      ]),
    );
    const customerMap = new Map(
      customerAggregates.map((row) => [
        row.tenantId,
        Number(row.customersCount ?? 0) || 0,
      ]),
    );

    return activeTenants.map((tenant) => {
      const agg = orderMap.get(tenant.id);
      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug ?? null,
        logoUrl: tenant.logoUrl ?? null,
        ordersCount30d: agg?.ordersCount30d ?? 0,
        revenue30d: agg?.revenue30d ?? 0,
        customersCount: customerMap.get(tenant.id) ?? 0,
      };
    });
  }

  async getFeatureFlags(tenantId: string) {
    await this.ensureTenantExists(tenantId);
    const row = await this.db.query.tenantFeatureFlags.findFirst({
      where: eq(tenantFeatureFlags.tenantId, tenantId),
    });
    return row ?? null;
  }

  async updateFeatureFlags(
    tenantId: string,
    patch: UpdateTenantFeatureFlagsDto,
  ) {
    await this.ensureTenantExists(tenantId);

    const sanitized = TENANT_FEATURE_FLAG_KEYS.reduce<
      Partial<UpdateTenantFeatureFlagsDto>
    >((acc, key) => {
      const value = patch[key];
      if (typeof value === "boolean") {
        acc[key] = value;
      }
      return acc;
    }, {});

    const existing = await this.db.query.tenantFeatureFlags.findFirst({
      where: eq(tenantFeatureFlags.tenantId, tenantId),
    });

    if (existing) {
      const [updated] = await this.db
        .update(tenantFeatureFlags)
        .set({ ...sanitized, updatedAt: new Date() })
        .where(eq(tenantFeatureFlags.tenantId, tenantId))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(tenantFeatureFlags)
      .values({ tenantId, ...sanitized })
      .returning();
    return created;
  }

  async getVerticalPreset(tenantId: string) {
    const tenant = await this.getById(tenantId);
    const preset = presetForVertical(tenant?.vertical);
    return {
      vertical: tenant?.vertical ?? "generic",
      layoutHint: tenant?.layoutHint ?? preset.layoutHint,
      terminologyKey: tenant?.terminologyKey ?? preset.terminologyKey,
      defaultFeatures: preset.defaultFeatures,
    };
  }
}

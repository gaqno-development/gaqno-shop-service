import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AxiosInstance } from "axios";
import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import {
  categories,
  customers,
  orders,
  products,
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
import { UpdateTenantProfileDto } from "./dto/update-tenant-profile.dto";
import { AI_SERVICE_HTTP_CLIENT } from "./ai-service-client";
import { GenerateStorefrontCopySuggestionDto } from "./dto/generate-storefront-copy-suggestion.dto";

export interface ITenantSummaryRow {
  readonly id: string;
  readonly localTenantId: string;
  readonly ssoTenantId: string;
  readonly name: string;
  readonly slug: string | null;
  readonly logoUrl: string | null;
  readonly ordersCount30d: number;
  readonly revenue30d: number;
  readonly customersCount: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PAID_PAYMENT_STATUSES = ["approved", "authorized"] as const;
const DEFAULT_SUGGESTION_MAX_PRODUCTS = 12;

interface IStorefrontSuggestionMetadata {
  readonly model: string | null;
  readonly generatedAt: string;
  readonly sourceProductsCount: number;
}

export interface IStorefrontCopySuggestionResult {
  readonly storefrontCopy: Record<string, unknown>;
  readonly metadata: IStorefrontSuggestionMetadata;
}

@Injectable()
export class TenantService {
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private mergePlainObject(
    base: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
      if (value === undefined) {
        continue;
      }
      if (this.isPlainObject(value)) {
        const currentValue = merged[key];
        const currentObject = this.isPlainObject(currentValue) ? currentValue : {};
        merged[key] = this.mergePlainObject(currentObject, value);
        continue;
      }
      merged[key] = value;
    }
    return merged;
  }

  private normalizeStorefrontCopy(
    storefrontCopy: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = this.mergePlainObject({}, storefrontCopy);
    const home = this.readObject(normalized.home);
    const sections = this.readObject(home?.sections);
    if (sections) {
      delete sections.featuredTitle;
      delete sections.featuredEyebrow;
      if (Object.keys(sections).length === 0 && home) {
        delete home.sections;
      }
    }
    return normalized;
  }

  private readMappedSsoTenantId(settings: unknown): string | null {
    if (!settings || typeof settings !== "object") return null;
    const value = (settings as { ssoTenantId?: unknown }).ssoTenantId;
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private async persistSsoTenantId(
    localTenantId: string,
    settings: unknown,
    ssoTenantId: string,
  ): Promise<void> {
    const current =
      settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
    await this.db
      .update(tenants)
      .set({
        settings: {
          ...current,
          ssoTenantId,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, localTenantId));
  }

  private async resolveCanonicalSsoTenantId(tenant: {
    readonly id: string;
    readonly slug: string | null;
    readonly settings: unknown;
  }): Promise<string> {
    const fromSettings = this.readMappedSsoTenantId(tenant.settings);
    if (fromSettings) {
      return fromSettings;
    }
    if (!this.ssoClient) {
      return tenant.id;
    }
    const byId = await this.ssoClient.getById(tenant.id);
    if (byId?.id) {
      return byId.id;
    }
    if (!tenant.slug) {
      return tenant.id;
    }
    const bySlug = await this.ssoClient.getBySlug(tenant.slug);
    if (!bySlug?.id) {
      return tenant.id;
    }
    if (bySlug.id !== tenant.id) {
      await this.persistSsoTenantId(tenant.id, tenant.settings, bySlug.id);
    }
    return bySlug.id;
  }

  private readonly logger = new Logger(TenantService.name);

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    @Inject(AI_SERVICE_HTTP_CLIENT)
    private readonly aiHttpClient: AxiosInstance,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(SsoTenantClient)
    private readonly ssoClient?: SsoTenantClient,
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
    const existingById = await this.getById(projection.id);
    if (existingById) {
      const [updated] = await this.db
        .update(tenants)
        .set({
          slug: projection.slug,
          name: projection.name,
          vertical: projection.vertical ?? existingById.vertical ?? "generic",
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, projection.id))
        .returning();
      return updated ?? existingById;
    }
    const existingBySlug = await this.getBySlug(projection.slug);
    if (existingBySlug && existingBySlug.id !== projection.id) {
      this.logger.warn(
        `SSO tenant ${projection.id} maps to slug ${projection.slug} already owned by local tenant ${existingBySlug.id}; using local row`,
      );
      return existingBySlug;
    }
    if (existingBySlug) {
      return existingBySlug;
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

  async listActive() {
    const rows = await this.db.query.tenants.findMany({
      where: eq(tenants.isActive, true),
      orderBy: [asc(tenants.name)],
    });
    return Promise.all(
      rows.map(async (tenant) => {
        const ssoTenantId = await this.resolveCanonicalSsoTenantId(tenant);
        return {
          ...tenant,
          id: ssoTenantId,
          localTenantId: tenant.id,
          ssoTenantId,
        };
      }),
    );
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

    const withCanonicalId = await Promise.all(
      activeTenants.map(async (tenant) => ({
        tenant,
        ssoTenantId: await this.resolveCanonicalSsoTenantId(tenant),
      })),
    );

    return withCanonicalId.map(({ tenant, ssoTenantId }) => {
      const agg = orderMap.get(tenant.id);
      return {
        id: ssoTenantId,
        localTenantId: tenant.id,
        ssoTenantId,
        name: tenant.name,
        slug: tenant.slug ?? null,
        logoUrl: tenant.logoUrl ?? null,
        ordersCount30d: agg?.ordersCount30d ?? 0,
        revenue30d: agg?.revenue30d ?? 0,
        customersCount: customerMap.get(tenant.id) ?? 0,
      };
    });
  }

  async generateStorefrontCopySuggestion(
    tenantId: string,
    dto: GenerateStorefrontCopySuggestionDto,
  ): Promise<IStorefrontCopySuggestionResult> {
    const tenant = await this.ensureTenantExists(tenantId);
    const maxProducts = dto.maxProducts ?? DEFAULT_SUGGESTION_MAX_PRODUCTS;
    const rows = await this.db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        shortDescription: products.shortDescription,
        price: products.price,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.tenantId, tenant.id), eq(products.isActive, true)))
      .orderBy(asc(products.updatedAt))
      .limit(maxProducts);

    const aiServiceUrl = this.configService.get<string>("AI_SERVICE_URL");
    if (!aiServiceUrl) {
      this.logger.error(
        `Storefront suggestion unavailable for tenant ${tenantId}: missing AI_SERVICE_URL`,
      );
      throw new ServiceUnavailableException(
        "AI suggestion unavailable: AI_SERVICE_URL is missing in shop-service environment",
      );
    }
    const aiSecret = this.configService.get<string>("INTERNAL_SYNC_SECRET") ?? "";
    const promptPayload = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        vertical: tenant.vertical,
        description: tenant.description,
      },
      products: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? row.shortDescription ?? "",
        category: row.categoryName ?? "",
        price: Number(row.price ?? 0),
      })),
      additionalContext: dto.additionalContext?.trim() ?? "",
    };

    const systemPrompt =
      "You generate storefrontCopy.home in pt-BR from tenant products. Return only a JSON object with keys v and home. Keep tone premium and conversion-focused.";
    const userPrompt = `Create a storefrontCopy suggestion using this data:\n${JSON.stringify(promptPayload)}`;
    const url = `${aiServiceUrl.replace(/\/+$/, "")}/v1/responses`;
    const response = await this.aiHttpClient.post<Record<string, unknown>>(
      url,
      {
        model: "gpt-4o-mini",
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        response_format: "json",
        temperature: 0.7,
        max_tokens: 1800,
      },
      {
        headers: { "x-internal-secret": aiSecret },
        timeout: 12000,
      },
    );
    const suggestedRoot = this.extractSuggestedStorefrontCopy(response.data);
    return {
      storefrontCopy: suggestedRoot,
      metadata: {
        model: "gpt-4o-mini",
        generatedAt: new Date().toISOString(),
        sourceProductsCount: rows.length,
      },
    };
  }

  private extractSuggestedStorefrontCopy(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const directCopy = this.readObject(payload.storefrontCopy);
    if (directCopy) {
      return directCopy;
    }
    const contentValue = payload.content;
    if (typeof contentValue === "string") {
      try {
        const parsed = JSON.parse(contentValue) as unknown;
        const parsedObject = this.readObject(parsed);
        if (parsedObject) {
          const nestedCopy = this.readObject(parsedObject.storefrontCopy);
          return nestedCopy ?? parsedObject;
        }
      } catch {
        throw new BadRequestException("AI response is not valid JSON");
      }
    }
    const asObject = this.readObject(payload);
    if (!asObject) {
      throw new BadRequestException("AI response payload is invalid");
    }
    return asObject;
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  async getFeatureFlags(tenantId: string) {
    const resolved = await this.ensureTenantExists(tenantId);
    const row = await this.db.query.tenantFeatureFlags.findFirst({
      where: eq(tenantFeatureFlags.tenantId, resolved.id),
    });
    return row ?? null;
  }

  async updateFeatureFlags(
    tenantId: string,
    patch: UpdateTenantFeatureFlagsDto,
  ) {
    const resolved = await this.ensureTenantExists(tenantId);
    const effectiveTenantId = resolved.id;

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
      where: eq(tenantFeatureFlags.tenantId, effectiveTenantId),
    });

    const nextCredit =
      typeof sanitized.featureCreditCard === "boolean"
        ? sanitized.featureCreditCard
        : (existing?.featureCreditCard ?? true);
    const nextBoleto =
      typeof sanitized.featureBoleto === "boolean"
        ? sanitized.featureBoleto
        : (existing?.featureBoleto ?? true);
    const paymentMethodPatch =
      typeof sanitized.featureCreditCard === "boolean" ||
      typeof sanitized.featureBoleto === "boolean";
    const featureCheckoutProSync = paymentMethodPatch
      ? nextCredit || nextBoleto
      : undefined;

    if (existing) {
      const [updated] = await this.db
        .update(tenantFeatureFlags)
        .set({
          ...sanitized,
          ...(featureCheckoutProSync !== undefined
            ? { featureCheckoutPro: featureCheckoutProSync }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(tenantFeatureFlags.tenantId, effectiveTenantId))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(tenantFeatureFlags)
      .values({
        tenantId: effectiveTenantId,
        ...sanitized,
        ...(featureCheckoutProSync !== undefined
          ? { featureCheckoutPro: featureCheckoutProSync }
          : {}),
      })
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

  private mergeIntoTenantSettings(
    current: unknown,
    dto: UpdateTenantProfileDto,
  ): Record<string, unknown> {
    const base: Record<string, unknown> =
      current && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : {};
    if (dto.adminDomain !== undefined) {
      const v = dto.adminDomain;
      if (v === null || v === "") delete base.adminDomain;
      else base.adminDomain = String(v).trim();
    }
    if (dto.publicShopUrl !== undefined) {
      const v = dto.publicShopUrl;
      if (v === null || v === "") delete base.publicShopUrl;
      else base.publicShopUrl = String(v).trim();
    }
    if (dto.analyticsMeasurementId !== undefined) {
      const v = dto.analyticsMeasurementId;
      if (v === null || v === "") delete base.analyticsMeasurementId;
      else base.analyticsMeasurementId = String(v).trim();
    }
    if (dto.analyticsEnabled !== undefined) {
      base.analyticsEnabled = dto.analyticsEnabled;
    }
    if (dto.storefrontCopy !== undefined) {
      if (dto.storefrontCopy === null || !this.isPlainObject(dto.storefrontCopy)) {
        delete base.storefrontCopy;
      } else {
        const currentStorefrontCopy = this.isPlainObject(base.storefrontCopy)
          ? base.storefrontCopy
          : {};
        const mergedStorefrontCopy = this.mergePlainObject(
          currentStorefrontCopy as Record<string, unknown>,
          dto.storefrontCopy as Record<string, unknown>,
        );
        base.storefrontCopy = this.normalizeStorefrontCopy(mergedStorefrontCopy);
      }
    }
    return base;
  }

  async updateProfile(tenantId: string, dto: UpdateTenantProfileDto) {
    const resolved = await this.ensureTenantExists(tenantId);
    const id = resolved.id;

    if (dto.slug !== undefined && dto.slug !== resolved.slug) {
      const taken = await this.db.query.tenants.findFirst({
        where: and(eq(tenants.slug, dto.slug), ne(tenants.id, id)),
      });
      if (taken) {
        throw new ConflictException("Slug already in use");
      }
    }

    if (dto.domain !== undefined) {
      const nextDomain =
        dto.domain === null || dto.domain === ""
          ? null
          : dto.domain.trim();
      const prev = resolved.domain ?? null;
      if (nextDomain !== prev && nextDomain) {
        const taken = await this.db.query.tenants.findFirst({
          where: and(eq(tenants.domain, nextDomain), ne(tenants.id, id)),
        });
        if (taken) {
          throw new ConflictException("Domain already in use");
        }
      }
    }

    const patch: {
      updatedAt: Date;
      name?: string;
      slug?: string;
      domain?: string | null;
      description?: string | null;
      primaryColor?: string;
      bgColor?: string;
      secondaryColor?: string;
      logoUrl?: string | null;
      faviconUrl?: string | null;
      isActive?: boolean;
      isDropshipping?: boolean;
      vertical?: string;
      layoutHint?: string;
      terminologyKey?: string;
      orderPrefix?: string;
      settings?: Record<string, unknown>;
    } = { updatedAt: new Date() };

    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.domain !== undefined) {
      patch.domain =
        dto.domain === null || dto.domain === ""
          ? null
          : dto.domain.trim();
    }
    if (dto.description !== undefined) {
      patch.description =
        dto.description === null || dto.description === ""
          ? null
          : dto.description;
    }
    if (dto.primaryColor !== undefined) patch.primaryColor = dto.primaryColor;
    if (dto.bgColor !== undefined) patch.bgColor = dto.bgColor;
    if (dto.secondaryColor !== undefined) {
      patch.secondaryColor = dto.secondaryColor;
    }
    if (dto.logoUrl !== undefined) {
      patch.logoUrl =
        dto.logoUrl === null || dto.logoUrl === "" ? null : dto.logoUrl;
    }
    if (dto.faviconUrl !== undefined) {
      patch.faviconUrl =
        dto.faviconUrl === null || dto.faviconUrl === "" ? null : dto.faviconUrl;
    }
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.isDropshipping !== undefined) {
      patch.isDropshipping = dto.isDropshipping;
    }
    if (dto.vertical !== undefined) patch.vertical = dto.vertical;
    if (dto.layoutHint !== undefined) patch.layoutHint = dto.layoutHint;
    if (dto.terminologyKey !== undefined) {
      patch.terminologyKey = dto.terminologyKey;
    }
    if (dto.orderPrefix !== undefined) patch.orderPrefix = dto.orderPrefix;

    if (
      dto.adminDomain !== undefined ||
      dto.publicShopUrl !== undefined ||
      dto.analyticsMeasurementId !== undefined ||
      dto.analyticsEnabled !== undefined ||
      dto.storefrontCopy !== undefined
    ) {
      patch.settings = this.mergeIntoTenantSettings(resolved.settings, dto);
    }

    const [updated] = await this.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, id))
      .returning();

    return updated ?? resolved;
  }

  async syncFromSso(ssoTenantId: string) {
    if (!this.ssoClient) {
      throw new BadRequestException("SSO sync is not configured");
    }
    const projection = await this.ssoClient.getById(ssoTenantId);
    if (!projection?.slug) {
      throw new NotFoundException(
        `SSO organization ${ssoTenantId} not found or has no slug`,
      );
    }
    const row = await this.upsertFromSso(projection);
    if (!row) {
      throw new BadRequestException("Failed to sync tenant from SSO");
    }
    await this.ensureDefaultFeatureFlags(row.id);
    return row;
  }

  private async ensureDefaultFeatureFlags(localTenantId: string) {
    const existing = await this.db.query.tenantFeatureFlags.findFirst({
      where: eq(tenantFeatureFlags.tenantId, localTenantId),
    });
    if (existing) return existing;
    const [created] = await this.db
      .insert(tenantFeatureFlags)
      .values({ tenantId: localTenantId })
      .returning();
    return created;
  }
}

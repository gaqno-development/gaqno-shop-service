import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TenantService } from "../../tenant/tenant.service";
import { tenantContextStorage, TenantContext } from "../tenant-context";
import type { Tenant } from "../../database/schema";
import { SsoTenantClient } from "../sso-tenant-client";

interface JwtPayload {
  readonly sub?: string;
  readonly tenantId?: string;
  readonly email?: string;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly ssoClient: SsoTenantClient,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const tenant = await this.resolveTenant(req);
    if (!tenant) {
      next();
      return;
    }
    const context = this.buildContext(tenant);
    tenantContextStorage.run(context, () => next());
  }

  private async resolveTenant(req: Request): Promise<Tenant | null | undefined> {
    const tenantIdFromJwt = this.extractTenantIdFromAuth(req);
    if (tenantIdFromJwt) {
      const byId = await this.tenantService.getById(tenantIdFromJwt);
      if (byId) return byId;
      const synced = await this.lazySyncFromSso(tenantIdFromJwt);
      if (synced) return synced;
    }

    const slugHeader = req.headers["x-tenant-slug"] as string | undefined;
    if (slugHeader) {
      const bySlug = await this.tenantService.getBySlug(slugHeader);
      if (bySlug) return bySlug;
    }

    const domainHeader = req.headers["x-tenant-domain"] as string | undefined;
    const host = req.headers.host || "";
    const lookupDomain = domainHeader || host;
    const byDomain = await this.tenantService.resolve(lookupDomain);
    if (byDomain) return byDomain;
    const slugFromDomain = this.extractSlugFromDomain(lookupDomain);
    if (slugFromDomain) {
      const byDerivedSlug = await this.tenantService.getBySlug(slugFromDomain);
      if (byDerivedSlug) return byDerivedSlug;
    }
    const ssoTenantId = await this.ssoClient.getTenantIdByDomain(lookupDomain);
    if (ssoTenantId) {
      const syncedFromDomain = await this.lazySyncFromSso(ssoTenantId);
      if (syncedFromDomain) return syncedFromDomain;
      const ssoProjection = await this.ssoClient.getById(ssoTenantId);
      if (ssoProjection?.slug) {
        const byTrustedSsoSlug = await this.tenantService.getBySlug(
          ssoProjection.slug,
        );
        if (byTrustedSsoSlug) return byTrustedSsoSlug;
      }
    }
    return null;
  }

  private async lazySyncFromSso(
    ssoTenantId: string,
  ): Promise<Tenant | null | undefined> {
    try {
      const projection = await this.ssoClient.getById(ssoTenantId);
      if (!projection) {
        this.logger.warn(
          `SSO returned no tenant for id ${ssoTenantId}; cannot sync`,
        );
        return null;
      }
      const upserted = await this.tenantService.upsertFromSso(projection);
      if (upserted) return upserted as Tenant;
      return null;
    } catch (error) {
      this.logger.warn(
        `Lazy SSO sync failed for ${ssoTenantId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private extractTenantIdFromAuth(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return undefined;
    const token = header.slice(7).trim();
    if (!token) return undefined;
    try {
      const secret = this.configService.get<string>("JWT_SECRET");
      const decoded = this.jwtService.verify<JwtPayload>(token, { secret });
      return decoded.tenantId;
    } catch {
      return undefined;
    }
  }

  private buildContext(tenant: Tenant): TenantContext {
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      domain: tenant.domain,
      name: tenant.name,
      isDropshipping: Boolean(tenant.isDropshipping),
      orderPrefix: tenant.orderPrefix ?? "ORD",
    };
  }

  private extractSlugFromDomain(domain: string): string | null {
    const normalized = domain.trim().toLowerCase().replace(/:\d+$/, "");
    const hostname = normalized.replace(/^https?:\/\//, "").split("/")[0];
    if (!hostname.endsWith(".gaqno.com.br")) return null;
    const slug = hostname.replace(/\.gaqno\.com\.br$/, "");
    return slug && !slug.includes(".") ? slug : null;
  }
}

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

    const tenantIdFromJwt = this.extractTenantIdFromAuth(req);
    if (!tenantIdFromJwt) return null;

    const byId = await this.tenantService.getById(tenantIdFromJwt);
    if (byId) return byId;

    return this.lazySyncFromSso(tenantIdFromJwt);
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
      if (projection.slug) {
        return this.tenantService.getBySlug(projection.slug);
      }
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
      const decoded = this.jwtService.decode(token) as JwtPayload | null;
      return decoded?.tenantId;
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
}

import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TenantService } from "../../tenant/tenant.service";
import { tenantContextStorage, TenantContext } from "../tenant-context";
import type { Tenant } from "../../database/schema";

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
    if (tenantIdFromJwt) {
      return this.tenantService.getById(tenantIdFromJwt);
    }

    return null;
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

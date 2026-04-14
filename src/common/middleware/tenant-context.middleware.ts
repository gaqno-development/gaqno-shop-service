import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { TenantService } from "../../tenant/tenant.service";
import { tenantContextStorage, TenantContext } from "./tenant-context";

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Try header first
    const domain = req.headers["x-tenant-domain"] as string;
    
    // 2. Try subdomain from host
    const host = req.headers.host || "";
    
    // 3. Resolve tenant
    const lookupDomain = domain || host;
    const tenant = await this.tenantService.resolve(lookupDomain);
    
    if (tenant) {
      const context: TenantContext = {
        tenantId: tenant.id,
        slug: tenant.slug,
        domain: tenant.domain,
        name: tenant.name,
        isDropshipping: tenant.isDropshipping,
        orderPrefix: tenant.orderPrefix,
      };
      
      // Run in tenant context
      tenantContextStorage.run(context, () => {
        next();
      });
    } else {
      // No tenant found - continue without context
      next();
    }
  }
}

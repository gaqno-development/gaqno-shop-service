import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { TenantService } from "./tenant.service";

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Try header first
    const domain = req.headers["x-tenant-domain"] as string;
    
    // 2. Try subdomain from host
    const host = req.headers.host || "";
    const subdomain = host.split(".")[0];
    
    // 3. Resolve tenant
    const lookupDomain = domain || host;
    const tenant = await this.tenantService.resolve(lookupDomain);
    
    if (tenant) {
      // Set tenant context on request
      (req as any).tenant = tenant;
      
      // Set Postgres RLS variable (will be used by database queries)
      // This is a placeholder - actual implementation depends on your DB setup
      (req as any).tenantId = tenant.id;
    }
    
    next();
  }
}

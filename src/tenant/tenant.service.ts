import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { tenantFeatureFlags, tenants } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";

@Injectable()
export class TenantService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

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

  getFeatureFlags(tenantId: string) {
    return this.db.query.tenantFeatureFlags.findFirst({
      where: eq(tenantFeatureFlags.tenantId, tenantId),
    });
  }
}

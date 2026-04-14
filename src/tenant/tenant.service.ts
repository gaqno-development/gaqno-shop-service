import { Injectable } from "@nestjs/common";
import { Inject } from "@nestjs/common";

@Injectable()
export class TenantService {
  constructor(@Inject("DATABASE") private db: any) {}

  async resolve(domain: string) {
    const tenant = await this.db.query.tenants.findFirst({
      where: (tenants: any, { eq }: any) => eq(tenants.domain, domain),
    });
    return tenant;
  }

  async getBySlug(slug: string) {
    const tenant = await this.db.query.tenants.findFirst({
      where: (tenants: any, { eq }: any) => eq(tenants.slug, slug),
    });
    return tenant;
  }

  async getFeatureFlags(tenantId: string) {
    const flags = await this.db.query.tenantFeatureFlags.findFirst({
      where: (flags: any, { eq }: any) => eq(flags.tenantId, tenantId),
    });
    return flags;
  }
}

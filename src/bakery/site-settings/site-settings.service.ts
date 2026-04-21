import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  siteSettings,
  SiteSettings,
  NewSiteSettings,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import { UpsertSiteSettingsDto } from "./dto/site-settings.dto";

@Injectable()
export class SiteSettingsService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async getOrCreate(tenantId: string): Promise<SiteSettings> {
    const existing = await this.db.query.siteSettings.findFirst({
      where: eq(siteSettings.tenantId, tenantId),
    });
    if (existing) {
      return existing;
    }
    const payload: NewSiteSettings = { tenantId };
    const [row] = await this.db
      .insert(siteSettings)
      .values(payload)
      .returning();
    return row;
  }

  async upsert(
    tenantId: string,
    dto: UpsertSiteSettingsDto,
  ): Promise<SiteSettings> {
    const existing = await this.db.query.siteSettings.findFirst({
      where: eq(siteSettings.tenantId, tenantId),
    });
    if (!existing) {
      const payload: NewSiteSettings = { tenantId, ...dto };
      const [row] = await this.db
        .insert(siteSettings)
        .values(payload)
        .returning();
      return row;
    }
    const [row] = await this.db
      .update(siteSettings)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(siteSettings.tenantId, tenantId))
      .returning();
    return row;
  }
}

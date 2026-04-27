import { Module } from "@nestjs/common";
import { SiteSettingsController } from "./site-settings.controller";
import { SiteSettingsService } from "./site-settings.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [SiteSettingsService],
  controllers: [SiteSettingsController],
  exports: [SiteSettingsService],
})
export class StorefrontSiteSettingsModule {}

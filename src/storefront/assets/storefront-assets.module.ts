import { Module } from "@nestjs/common";
import { StorefrontAssetsController } from "./storefront-assets.controller";
import { StorefrontAssetsService } from "./storefront-assets.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [StorefrontAssetsService],
  controllers: [StorefrontAssetsController],
  exports: [StorefrontAssetsService],
})
export class StorefrontAssetsModule {}

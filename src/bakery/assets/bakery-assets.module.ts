import { Module } from "@nestjs/common";
import { BakeryAssetsController } from "./bakery-assets.controller";
import { BakeryAssetsService } from "./bakery-assets.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [BakeryAssetsService],
  controllers: [BakeryAssetsController],
  exports: [BakeryAssetsService],
})
export class BakeryAssetsModule {}

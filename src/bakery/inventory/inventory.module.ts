import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}

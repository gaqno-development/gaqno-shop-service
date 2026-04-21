import { Module } from "@nestjs/common";
import { TenantModule } from "../../tenant/tenant.module";
import { InventoryModule } from "../inventory/inventory.module";
import { BakeryOrderLifecycleService } from "./bakery-order-lifecycle.service";

@Module({
  imports: [TenantModule, InventoryModule],
  providers: [BakeryOrderLifecycleService],
  exports: [BakeryOrderLifecycleService],
})
export class BakeryOrderLifecycleModule {}

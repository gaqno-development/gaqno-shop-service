import { Global, Module } from "@nestjs/common";
import { TenantModule } from "../../tenant/tenant.module";
import { InventoryModule } from "../inventory/inventory.module";
import { BakeryOrderLifecycleService } from "./bakery-order-lifecycle.service";
import { ORDER_LIFECYCLE_PLUGIN } from "../../order/order-lifecycle.plugin";

@Global()
@Module({
  imports: [TenantModule, InventoryModule],
  providers: [
    { provide: ORDER_LIFECYCLE_PLUGIN, useClass: BakeryOrderLifecycleService },
  ],
  exports: [ORDER_LIFECYCLE_PLUGIN],
})
export class BakeryOrderLifecycleModule {}

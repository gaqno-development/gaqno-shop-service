import { Module } from "@nestjs/common";
import { AdminEventsController } from "./admin-events.controller";
import { AdminEventsService } from "./admin-events.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [AdminEventsService],
  controllers: [AdminEventsController],
  exports: [AdminEventsService],
})
export class AdminEventsModule {}

import { Module } from "@nestjs/common";
import { StorefrontEventsController } from "./storefront-events.controller";
import { StorefrontEventsService } from "./storefront-events.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [StorefrontEventsService],
  controllers: [StorefrontEventsController],
  exports: [StorefrontEventsService],
})
export class StorefrontEventsModule {}

import { Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { TenantController, HealthController } from "./tenant.controller";

@Module({
  providers: [TenantService],
  controllers: [TenantController, HealthController],
  exports: [TenantService],
})
export class TenantModule {}

import { Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { TenantController } from "./tenant.controller";
import { TenantContextMiddleware } from "./tenant-context.middleware";

@Module({
  providers: [TenantService, TenantContextMiddleware],
  controllers: [TenantController],
  exports: [TenantService, TenantContextMiddleware],
})
export class TenantModule {}

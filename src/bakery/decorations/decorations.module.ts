import { Module } from "@nestjs/common";
import { DecorationsController } from "./decorations.controller";
import { DecorationsService } from "./decorations.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [DecorationsService],
  controllers: [DecorationsController],
  exports: [DecorationsService],
})
export class DecorationsModule {}

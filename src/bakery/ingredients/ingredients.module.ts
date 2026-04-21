import { Module } from "@nestjs/common";
import { IngredientsController } from "./ingredients.controller";
import { IngredientsService } from "./ingredients.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [IngredientsService],
  controllers: [IngredientsController],
  exports: [IngredientsService],
})
export class IngredientsModule {}

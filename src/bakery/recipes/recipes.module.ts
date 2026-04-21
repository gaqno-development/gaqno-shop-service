import { Module } from "@nestjs/common";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";
import { TenantModule } from "../../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  providers: [RecipesService],
  controllers: [RecipesController],
  exports: [RecipesService],
})
export class RecipesModule {}

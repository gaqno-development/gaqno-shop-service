import { Module } from "@nestjs/common";
import { CustomizationTypesController } from "./customization-types.controller";
import { CustomizationTypesService } from "./customization-types.service";

@Module({
  controllers: [CustomizationTypesController],
  providers: [CustomizationTypesService],
  exports: [CustomizationTypesService],
})
export class CustomizationTypesModule {}
import { Module } from "@nestjs/common";
import { ShippingController } from "./shipping.controller";
import { ShippingCalculatorService } from "./shipping-calculator.service";
import { ShippingMethodService } from "./shipping-method.service";
import { ShippingCacheService } from "./shipping-cache.service";
import { ShippingCarrierService } from "./shipping-carrier.service";
import { CorreiosService } from "./correios.service";
import { JadlogService } from "./jadlog.service";

@Module({
  controllers: [ShippingController],
  providers: [
    ShippingCalculatorService,
    ShippingMethodService,
    ShippingCacheService,
    ShippingCarrierService,
    CorreiosService,
    JadlogService,
  ],
  exports: [ShippingCalculatorService, ShippingMethodService],
})
export class ShippingModule {}

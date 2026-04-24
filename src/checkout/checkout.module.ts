import { Module } from "@nestjs/common";
import { OrderModule } from "../order/order.module";
import { ShippingModule } from "../shipping/shipping.module";
import { CouponsModule } from "../coupons/coupons.module";
import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";

@Module({
  imports: [OrderModule, ShippingModule, CouponsModule],
  providers: [CheckoutService],
  controllers: [CheckoutController],
})
export class CheckoutModule {}

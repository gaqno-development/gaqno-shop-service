import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingCalculatorService } from './shipping-calculator.service';
import { CorreiosService } from './correios.service';
import { JadlogService } from './jadlog.service';

@Module({
  controllers: [ShippingController],
  providers: [
    ShippingCalculatorService,
    CorreiosService,
    JadlogService,
  ],
  exports: [ShippingCalculatorService],
})
export class ShippingModule {}
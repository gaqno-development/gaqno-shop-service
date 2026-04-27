import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { PaymentGatewaysModule } from "../payment-gateways/payment-gateways.module";
import { PaymentQueueModule } from "./queue/payment-queue.module";

@Module({
  imports: [PaymentGatewaysModule, PaymentQueueModule],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}

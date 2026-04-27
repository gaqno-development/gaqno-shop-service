import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { PaymentGatewaysModule } from "../payment-gateways/payment-gateways.module";
import { PaymentQueueModule } from "./queue/payment-queue.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [PaymentGatewaysModule, PaymentQueueModule, MailModule],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}

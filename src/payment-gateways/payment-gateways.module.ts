import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PaymentGatewaysService } from "./payment-gateways.service";
import { PaymentGatewaysController } from "./payment-gateways.controller";
import { PaymentGatewayFactory } from "./payment-gateway.factory";
import { MercadoPagoProvider } from "./providers/mercado-pago.provider";
import { StripeProvider } from "./providers/stripe.provider";
import { PagSeguroProvider } from "./providers/pagseguro.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    PaymentGatewaysService,
    PaymentGatewayFactory,
    MercadoPagoProvider,
    StripeProvider,
    PagSeguroProvider,
  ],
  controllers: [PaymentGatewaysController],
  exports: [PaymentGatewaysService, PaymentGatewayFactory],
})
export class PaymentGatewaysModule {}

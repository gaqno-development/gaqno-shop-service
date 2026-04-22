import { Injectable, NotFoundException } from "@nestjs/common";
import {
  IPaymentGateway,
  PaymentProvider,
} from "./payment-gateway.interface";
import { MercadoPagoProvider } from "./providers/mercado-pago.provider";
import { StripeProvider } from "./providers/stripe.provider";
import { PagSeguroProvider } from "./providers/pagseguro.provider";

@Injectable()
export class PaymentGatewayFactory {
  private readonly providers: ReadonlyMap<PaymentProvider, IPaymentGateway>;

  constructor(
    mercadoPago: MercadoPagoProvider,
    stripe: StripeProvider,
    pagseguro: PagSeguroProvider
  ) {
    this.providers = new Map<PaymentProvider, IPaymentGateway>([
      ["mercado_pago", mercadoPago],
      ["stripe", stripe],
      ["pagseguro", pagseguro],
    ]);
  }

  get(provider: PaymentProvider): IPaymentGateway {
    const impl = this.providers.get(provider);
    if (!impl) {
      throw new NotFoundException(`Unknown payment provider: ${provider}`);
    }
    return impl;
  }

  list(): ReadonlyArray<PaymentProvider> {
    return Array.from(this.providers.keys());
  }
}

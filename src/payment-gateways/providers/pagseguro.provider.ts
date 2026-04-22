import { Injectable, NotImplementedException } from "@nestjs/common";
import {
  CheckoutInput,
  CheckoutResult,
  GatewayCredentials,
  IPaymentGateway,
  PaymentStatusInfo,
  PixInput,
  PixResult,
  RefundInput,
  RefundResult,
  ValidateCredentialsInput,
  ValidateCredentialsResult,
  WebhookEvent,
  WebhookVerifyInput,
} from "../payment-gateway.interface";

@Injectable()
export class PagSeguroProvider implements IPaymentGateway {
  readonly provider = "pagseguro" as const;

  async createCheckout(_input: CheckoutInput): Promise<CheckoutResult> {
    throw new NotImplementedException("PagSeguro provider not implemented yet");
  }

  async createPixPayment(_input: PixInput): Promise<PixResult> {
    throw new NotImplementedException("PagSeguro provider not implemented yet");
  }

  async getPaymentStatus(
    _paymentId: string,
    _credentials: GatewayCredentials,
  ): Promise<PaymentStatusInfo> {
    throw new NotImplementedException("PagSeguro provider not implemented yet");
  }

  async searchPaymentsByReference(
    _reference: string,
    _credentials: GatewayCredentials,
  ): Promise<PaymentStatusInfo | null> {
    throw new NotImplementedException("PagSeguro provider not implemented yet");
  }

  verifyWebhookSignature(_input: WebhookVerifyInput): boolean {
    return false;
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    throw new NotImplementedException("PagSeguro provider not implemented yet");
  }

  parseWebhook(_payload: unknown): WebhookEvent {
    throw new NotImplementedException("PagSeguro provider not implemented yet");
  }

  async validateCredentials(
    _input: ValidateCredentialsInput,
  ): Promise<ValidateCredentialsResult> {
    return { valid: false, reason: "PagSeguro provider not implemented yet" };
  }
}

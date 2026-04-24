import { Controller, Post, Get, Body, Param, Query, Headers } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { CreatePaymentDto, PaymentWebhookDto } from "./dto/payment.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";
import { requireTenantId } from "../common/tenant-guard";

@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentDto
  ) {
    return this.paymentService.createPayment(requireTenantId(tenant?.tenantId), dto);
  }

  @Get("status/:orderNumber")
  async getPaymentStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string
  ) {
    return this.paymentService.getPaymentStatus(requireTenantId(tenant?.tenantId), orderNumber);
  }

  @Get("methods")
  async getPaymentMethods(@CurrentTenant() tenant: TenantContext) {
    return this.paymentService.getEnabledPaymentMethods(requireTenantId(tenant?.tenantId));
  }

  @Post("webhook")
  async handleWebhook(
    @CurrentTenant() tenant: TenantContext,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Body() data: PaymentWebhookDto
  ) {
    return this.paymentService.handleWebhook(tenant?.tenantId, signature, data);
  }
}

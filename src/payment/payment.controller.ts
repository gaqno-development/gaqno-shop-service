import { Controller, Post, Get, Body, Param, Query, Headers } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { CreatePaymentDto, PaymentWebhookDto } from "./dto/payment.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";

@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.paymentService.createPayment(tenant.tenantId, dto);
  }

  @Get("status/:orderNumber")
  async getPaymentStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.paymentService.getPaymentStatus(tenant.tenantId, orderNumber);
  }

  @Post("webhook")
  async handleWebhook(
    @CurrentTenant() tenant: TenantContext,
    @Body() data: PaymentWebhookDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.paymentService.handleWebhook(tenant.tenantId, data);
  }
}

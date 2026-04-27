import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { CreatePaymentDto, RefundPaymentDto } from "./dto/payment.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";
import { requireTenantId } from "../common/tenant-guard";
import { AuthGuard } from "../auth/auth.guard";

@Controller("payments")
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Get("return")
  redirectPaymentReturn(
    @Query("order") order: string,
    @Query("tenant") tenant: string | undefined,
    @Res() res: Response,
  ) {
    const base = this.configService
      .get<string>("SHOP_STOREFRONT_PUBLIC_URL")
      ?.replace(/\/+$/, "");
    if (!base) {
      throw new BadRequestException("SHOP_STOREFRONT_PUBLIC_URL is not configured");
    }
    const qs = new URLSearchParams();
    if (order) qs.set("order", order);
    if (tenant) qs.set("tenant", tenant);
    res.redirect(302, `${base}/pagamento/retorno?${qs.toString()}`);
  }

  @Post()
  async createPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.createPayment(requireTenantId(tenant?.tenantId), dto);
  }

  @Get("status/:orderNumber")
  async getPaymentStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.paymentService.getPaymentStatus(
      requireTenantId(tenant?.tenantId),
      orderNumber,
    );
  }

  @Get("methods")
  async getPaymentMethods(@CurrentTenant() tenant: TenantContext) {
    return this.paymentService.getEnabledPaymentMethods(requireTenantId(tenant?.tenantId));
  }

  @Post(":orderNumber/refund")
  @UseGuards(AuthGuard)
  async refundPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentService.refundPayment(
      requireTenantId(tenant?.tenantId),
      orderNumber,
      dto.amountCents,
    );
  }

  @Post("webhook")
  async handleWebhook(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const raw =
      req.rawBody instanceof Buffer
        ? req.rawBody.toString("utf8")
        : typeof req.rawBody === "string"
          ? req.rawBody
          : "";
    if (!raw) {
      throw new BadRequestException("Missing raw body for webhook verification");
    }
    return this.paymentService.handleMercadoPagoWebhook({
      rawBody: raw,
      headers: req.headers as Record<string, string | string[] | undefined>,
      requestUrl: req.originalUrl,
      tenantId: tenant?.tenantId,
    });
  }
}

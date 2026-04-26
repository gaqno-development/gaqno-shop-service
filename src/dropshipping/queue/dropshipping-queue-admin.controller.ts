import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import type {
  DropshippingQueueMetrics,
  DropshippingTicketActionResponse,
  DropshippingTicketListResponse,
} from "@gaqno-development/types";
import { getCurrentTenant } from "../../common/tenant-context";
import { DropshippingQueueAdminService } from "./dropshipping-queue-admin.service";
import {
  CancelTicketDto,
  ListQueueQueryDto,
  RetryTicketDto,
} from "./dto/queue-admin.dto";

@Controller("dropshipping/queue")
export class DropshippingQueueAdminController {
  constructor(private readonly service: DropshippingQueueAdminService) {}

  @Get("tickets")
  list(@Query() query: ListQueueQueryDto): Promise<DropshippingTicketListResponse> {
    return this.service.list({ tenantId: this.requireTenant(), ...query });
  }

  @Get("metrics")
  metrics(): Promise<DropshippingQueueMetrics> {
    return this.service.metrics(this.requireTenant());
  }

  @Post("tickets/:ticketId/retry")
  async retry(
    @Param("ticketId") ticketId: string,
    @Body() dto: RetryTicketDto,
  ): Promise<DropshippingTicketActionResponse> {
    const ticket = await this.service.retry(
      ticketId,
      this.requireTenant(),
      dto.notes,
    );
    return { ticket };
  }

  @Post("tickets/:ticketId/cancel")
  async cancel(
    @Param("ticketId") ticketId: string,
    @Body() dto: CancelTicketDto,
  ): Promise<DropshippingTicketActionResponse> {
    const ticket = await this.service.cancel(
      ticketId,
      this.requireTenant(),
      dto.reason,
    );
    return { ticket };
  }

  private requireTenant(): string {
    const tenant = getCurrentTenant();
    if (!tenant) throw new BadRequestException("Tenant context is required");
    return tenant.tenantId;
  }
}

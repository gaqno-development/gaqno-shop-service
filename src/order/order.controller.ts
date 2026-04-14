import { Controller, Get, Post, Put, Body, Param, Query, ParseUUIDPipe } from "@nestjs/common";
import { OrderService } from "./order.service";
import { CreateOrderDto, UpdateOrderStatusDto, OrderQueryDto } from "./dto/order.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OrderQueryDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.orderService.findAll(tenant.tenantId, query);
  }

  @Get("customer/:customerId")
  async getCustomerOrders(
    @CurrentTenant() tenant: TenantContext,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Query("limit") limit?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.orderService.getCustomerOrders(
      tenant.tenantId,
      customerId,
      limit ? parseInt(limit) : 10
    );
  }

  @Get(":orderNumber")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.orderService.findOne(tenant.tenantId, orderNumber);
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateOrderDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.orderService.create(tenant.tenantId, tenant.slug, dto);
  }

  @Put(":orderNumber/status")
  async updateStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.orderService.updateStatus(tenant.tenantId, orderNumber, dto);
  }
}

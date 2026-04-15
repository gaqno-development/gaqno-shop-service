import { Controller, Get, Post, Put, Body, Param, Query, ParseUUIDPipe, UseGuards, Request } from "@nestjs/common";
import { OrderService } from "./order.service";
import { CreateOrderDto, UpdateOrderStatusDto, OrderQueryDto } from "./dto/order.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";
import { AuthGuard } from "../auth/auth.guard";

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
  async getCustomerOrdersById(
    @CurrentTenant() tenant: TenantContext,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.orderService.getCustomerOrders(
      tenant.tenantId,
      customerId,
      {
        page: parseInt(page),
        limit: parseInt(limit),
      }
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

  // Customer authenticated endpoints
  @Get("my-orders")
  @UseGuards(AuthGuard)
  async getMyOrders(
    @CurrentTenant() tenant: TenantContext,
    @Request() req,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status?: string,
  ) {
    return this.orderService.getCustomerOrders(
      tenant.tenantId,
      req.customer.customerId,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      }
    );
  }

  @Get("my-orders/:id")
  @UseGuards(AuthGuard)
  async getMyOrderDetail(
    @CurrentTenant() tenant: TenantContext,
    @Request() req,
    @Param("id", ParseUUIDPipe) orderId: string,
  ) {
    return this.orderService.getCustomerOrderDetail(
      tenant.tenantId,
      req.customer.customerId,
      orderId
    );
  }

  @Get("track/:orderNumber")
  async trackOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param("orderNumber") orderNumber: string,
    @Query("email") email: string,
  ) {
    return this.orderService.trackOrder(tenant.tenantId, orderNumber, email);
  }
}

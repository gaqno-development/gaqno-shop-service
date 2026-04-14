import { Controller, Get, Post, Put, Body, Param, Query, ParseUUIDPipe } from "@nestjs/common";
import { CustomerService } from "./customer.service";
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from "./dto/customer.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";

@Controller("customers")
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerQueryDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.customerService.findAll(tenant.tenantId, query);
  }

  @Get(":id")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.customerService.findOne(tenant.tenantId, id);
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.customerService.create(tenant.tenantId, dto);
  }

  @Put(":id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.customerService.update(tenant.tenantId, id, dto);
  }

  @Get(":id/addresses")
  async getAddresses(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.customerService.getAddresses(tenant.tenantId, id);
  }
}

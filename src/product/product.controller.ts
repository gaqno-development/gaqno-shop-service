import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ProductService } from "./product.service";
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from "./dto/product.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";

@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProductQueryDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.productService.findAll(tenant.tenantId, query);
  }

  @Get("featured")
  async getFeatured(
    @CurrentTenant() tenant: TenantContext,
    @Query("limit") limit?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.productService.getFeatured(tenant.tenantId, limit ? parseInt(limit) : 8);
  }

  @Get(":slug")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("slug") slug: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.productService.findOne(tenant.tenantId, slug);
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProductDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.productService.create(tenant.tenantId, dto);
  }

  @Put(":id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.productService.update(tenant.tenantId, id, dto);
  }

  @Delete(":id")
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    await this.productService.delete(tenant.tenantId, id);
    return { success: true };
  }
}

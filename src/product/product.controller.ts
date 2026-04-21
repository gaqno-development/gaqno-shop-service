import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
  @Patch(":id")
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

  @Post("bulk-delete")
  async bulkDelete(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: { ids: string[] },
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    await Promise.all(
      (body.ids ?? []).map((id) =>
        this.productService.delete(tenant.tenantId, id),
      ),
    );
    return { success: true, count: body.ids?.length ?? 0 };
  }

  @Post("bulk-update")
  async bulkUpdate(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: { ids: string[]; isVisible?: boolean; isActive?: boolean },
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    const isActive = body.isActive ?? body.isVisible;
    if (isActive === undefined) {
      return { success: false, reason: "no-op" };
    }
    await Promise.all(
      (body.ids ?? []).map((id) =>
        this.productService.update(tenant.tenantId, id, { isActive }),
      ),
    );
    return { success: true, count: body.ids?.length ?? 0 };
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

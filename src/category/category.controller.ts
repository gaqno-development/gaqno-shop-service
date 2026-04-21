import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { CategoryService } from "./category.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";

@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async findAll(@CurrentTenant() tenant: TenantContext) {
    if (!tenant) {
      return [];
    }
    return this.categoryService.findAll(tenant.tenantId);
  }

  @Get(":slug")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("slug") slug: string,
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.categoryService.findOne(tenant.tenantId, slug);
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCategoryDto,
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.categoryService.create(tenant.tenantId, dto);
  }

  @Put(":id")
  @Patch(":id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.categoryService.update(tenant.tenantId, id, dto);
  }

  @Delete(":id")
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    await this.categoryService.delete(tenant.tenantId, id);
    return { success: true };
  }
}

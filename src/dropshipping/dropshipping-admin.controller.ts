import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { DropshippingImportedProduct } from "@gaqno-development/types";
import { getCurrentTenant } from "../common/tenant-context";
import { DropshippingCatalogService } from "./dropshipping-catalog.service";
import { DropshippingImportService } from "./dropshipping-import.service";
import {
  DropshippingSearchQueryDto,
  ImportedProductsQueryDto,
  ImportProductDto,
} from "./dto/dropshipping.dto";

@Controller("drops")
export class DropshippingAdminController {
  constructor(
    private readonly catalog: DropshippingCatalogService,
    private readonly importer: DropshippingImportService,
  ) {}

  @Get("test")
  test(): { ok: boolean; ts: number } {
    return { ok: true, ts: Date.now() };
  }

  @Get("providers")
  listProviders(): { providers: readonly string[] } {
    return { providers: this.catalog.availableProviders() };
  }

  @Get("products")
  async listProducts(
    @Query() query: ImportedProductsQueryDto,
  ): Promise<{
    items: readonly DropshippingImportedProduct[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenant = getCurrentTenant();
    if (!tenant) throw new BadRequestException("Tenant context is required");
    return this.importer.listProducts({
      tenantId: tenant.tenantId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
    });
  }

  @Post("import")
  async import(@Body() dto: ImportProductDto): Promise<DropshippingImportedProduct> {
    const tenant = getCurrentTenant();
    if (!tenant) throw new BadRequestException("Tenant context is required");
    return this.importer.importProduct({
      tenantId: tenant.tenantId,
      providerCode: dto.providerCode,
      externalId: dto.externalId,
      categoryId: dto.categoryId,
      overrideMarginPercent: dto.overrideMarginPercent,
      makeActive: dto.makeActive ?? true,
    });
  }

  @Patch("products/:productId")
  async updateProduct(
    @Param("productId") productId: string,
    @Body() body: { isActive?: boolean; marginPercent?: number; categoryId?: string },
  ): Promise<void> {
    const tenant = getCurrentTenant();
    if (!tenant) throw new BadRequestException("Tenant context is required");
    await this.importer.updateProduct(tenant.tenantId, productId, body);
  }

  @Delete("products/:productId")
  async deleteProduct(
    @Param("productId") productId: string,
  ): Promise<void> {
    const tenant = getCurrentTenant();
    if (!tenant) throw new BadRequestException("Tenant context is required");
    await this.importer.deleteProduct(tenant.tenantId, productId);
  }

  @Post("products/bulk")
  async bulkAction(
    @Body() body: { productIds: readonly string[]; action: "activate" | "deactivate" | "delete" },
  ): Promise<void> {
    const tenant = getCurrentTenant();
    if (!tenant) throw new BadRequestException("Tenant context is required");
    await this.importer.bulkAction(tenant.tenantId, body.productIds, body.action);
  }

  @Get("search/:providerCode")
  search(
    @Param("providerCode") providerCode: string,
    @Query() query: DropshippingSearchQueryDto,
  ): Promise<{ items: readonly unknown[]; total: number; page: number; pageSize: number }> {
    return this.catalog.search({ providerCode, ...query });
  }

  @Get(":providerCode/product/:externalId")
  getDetails(
    @Param("providerCode") providerCode: string,
    @Param("externalId") externalId: string,
  ): Promise<unknown> {
    return this.catalog.getDetails(providerCode, externalId);
  }
}
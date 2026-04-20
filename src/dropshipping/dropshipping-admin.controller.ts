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
  DropshippingImportedProduct,
  DropshippingProvidersResponse,
  DropshippingSearchResponse,
  SupplierProductDetail,
} from "@gaqno-development/types";
import { getCurrentTenant } from "../common/tenant-context";
import { DropshippingCatalogService } from "./dropshipping-catalog.service";
import { DropshippingImportService } from "./dropshipping-import.service";
import {
  DropshippingSearchQueryDto,
  ImportProductDto,
} from "./dto/dropshipping.dto";

@Controller("admin/dropshipping")
export class DropshippingAdminController {
  constructor(
    private readonly catalog: DropshippingCatalogService,
    private readonly importer: DropshippingImportService,
  ) {}

  @Get("providers")
  listProviders(): DropshippingProvidersResponse {
    return { providers: this.catalog.availableProviders() };
  }

  @Get("search/:providerCode")
  search(
    @Param("providerCode") providerCode: string,
    @Query() query: DropshippingSearchQueryDto,
  ): Promise<DropshippingSearchResponse> {
    return this.catalog.search({ providerCode, ...query });
  }

  @Get(":providerCode/product/:externalId")
  getDetails(
    @Param("providerCode") providerCode: string,
    @Param("externalId") externalId: string,
  ): Promise<SupplierProductDetail> {
    return this.catalog.getDetails(providerCode, externalId);
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
}

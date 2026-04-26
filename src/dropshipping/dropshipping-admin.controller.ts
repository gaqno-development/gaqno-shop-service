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
  ImportedProductsQueryDto,
  ImportProductDto,
} from "./dto/dropshipping.dto";

@Controller("drp")
export class DropshippingAdminController {
  constructor() {}

  @Get("test")
  test(): { ok: boolean } {
    return { ok: true };
  }
}

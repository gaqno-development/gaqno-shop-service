import { Controller, Get, Param, Query } from "@nestjs/common";
import { ProductService } from "./product.service";

@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(@Query() query: any) {
    // TODO: Get tenantId from context
    const tenantId = "temp-tenant-id";
    return this.productService.findAll(tenantId, query);
  }

  @Get(":slug")
  async findOne(@Param("slug") slug: string) {
    // TODO: Get tenantId from context
    const tenantId = "temp-tenant-id";
    return this.productService.findOne(tenantId, slug);
  }
}

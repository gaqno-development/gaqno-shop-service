import {
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { StorefrontAssetsService } from "./storefront-assets.service";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";

@Controller("storefront/assets")
export class StorefrontAssetsController {
  constructor(private readonly service: StorefrontAssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!tenant) {
      throw new ForbiddenException("Tenant context not available");
    }
    return this.service.saveImage(tenant.tenantId, file);
  }
}

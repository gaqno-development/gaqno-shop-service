import {
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { BakeryAssetsService } from "./bakery-assets.service";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/assets")
@UseGuards(FeatureFlagGuard)
@RequireFeature("featureBakery")
export class BakeryAssetsController {
  constructor(private readonly service: BakeryAssetsService) {}

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

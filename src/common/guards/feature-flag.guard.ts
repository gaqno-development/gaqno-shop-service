import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TenantService } from "../../tenant/tenant.service";
import { getCurrentTenant } from "../tenant-context";
import {
  REQUIRE_FEATURE_KEY,
  BakeryFeature,
} from "../decorators/require-feature.decorator";

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<BakeryFeature | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const tenant = getCurrentTenant();
    if (!tenant) {
      throw new ForbiddenException("Tenant context not available");
    }

    const flags = await this.tenantService.getFeatureFlags(tenant.tenantId);
    if (!flags || flags[required] !== true) {
      throw new ForbiddenException(
        `Feature '${required}' not enabled for this tenant`,
      );
    }
    return true;
  }
}

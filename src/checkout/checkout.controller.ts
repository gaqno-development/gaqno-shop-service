import { Body, Controller, Post } from "@nestjs/common";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";
import { requireTenantId } from "../common/tenant-guard";
import { CheckoutService } from "./checkout.service";
import { CheckoutRequestDto } from "./dto/checkout.dto";

@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  async checkout(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CheckoutRequestDto,
  ) {
    return this.checkoutService.checkout(
      requireTenantId(tenant?.tenantId),
      tenant?.slug ?? "default",
      dto,
    );
  }
}

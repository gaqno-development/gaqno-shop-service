import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { Observable, filter, map } from "rxjs";
import { AdminEventsService } from "./admin-events.service";
import {
  CreateAdminEventDto,
  UpdateAdminEventDto,
} from "./dto/admin-events.dto";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/calendar")
@UseGuards(FeatureFlagGuard)
@RequireFeature("featureBakery")
export class AdminEventsController {
  constructor(private readonly service: AdminEventsService) {}

  @Get("events")
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    this.assertTenant(tenant);
    return this.service.findRange(tenant.tenantId, from, to);
  }

  @Get("events/:id")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    return this.service.findById(tenant.tenantId, id);
  }

  @Post("events")
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateAdminEventDto,
  ) {
    this.assertTenant(tenant);
    return this.service.create(tenant.tenantId, dto);
  }

  @Put("events/:id")
  @Patch("events/:id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminEventDto,
  ) {
    this.assertTenant(tenant);
    return this.service.update(tenant.tenantId, id, dto);
  }

  @Delete("events/:id")
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    await this.service.delete(tenant.tenantId, id);
    return { success: true };
  }

  @Sse("stream")
  stream(@CurrentTenant() tenant: TenantContext): Observable<MessageEvent> {
    this.assertTenant(tenant);
    const tenantId = tenant.tenantId;
    return this.service.observe().pipe(
      filter((n) => n.tenantId === tenantId),
      map((n) => ({
        type: n.event,
        data: n.payload,
      })),
    );
  }

  private assertTenant(
    tenant: TenantContext | undefined,
  ): asserts tenant is TenantContext {
    if (!tenant) {
      throw new ForbiddenException("Tenant context not available");
    }
  }
}

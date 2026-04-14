import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers } from "@nestjs/common";
import { CartService } from "./cart.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart.dto";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";

@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(
    @CurrentTenant() tenant: TenantContext,
    @Headers("x-session-id") sessionId: string,
    @Query("customerId") customerId?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.cartService.getCart(tenant.tenantId, sessionId, customerId);
  }

  @Get("summary")
  async getCartSummary(
    @CurrentTenant() tenant: TenantContext,
    @Headers("x-session-id") sessionId: string,
    @Query("customerId") customerId?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.cartService.getCartSummary(tenant.tenantId, sessionId, customerId);
  }

  @Post("items")
  async addItem(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: AddCartItemDto,
    @Headers("x-session-id") sessionId: string,
    @Query("customerId") customerId?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.cartService.addItem(tenant.tenantId, dto, sessionId, customerId);
  }

  @Put("items/:productId")
  async updateItem(
    @CurrentTenant() tenant: TenantContext,
    @Param("productId") productId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers("x-session-id") sessionId: string,
    @Query("customerId") customerId?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.cartService.updateItem(
      tenant.tenantId,
      productId,
      dto,
      sessionId,
      customerId
    );
  }

  @Delete("items/:productId")
  async removeItem(
    @CurrentTenant() tenant: TenantContext,
    @Param("productId") productId: string,
    @Headers("x-session-id") sessionId: string,
    @Query("customerId") customerId?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.cartService.removeItem(tenant.tenantId, productId, sessionId, customerId);
  }

  @Delete()
  async clearCart(
    @CurrentTenant() tenant: TenantContext,
    @Headers("x-session-id") sessionId: string,
    @Query("customerId") customerId?: string
  ) {
    if (!tenant) {
      return { error: "Tenant not found" };
    }
    return this.cartService.clearCart(tenant.tenantId, sessionId, customerId);
  }
}

import { Module, NestModule, MiddlewareConsumer, Controller, Get } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { DatabaseModule } from "./database/database.module";
import { TenantModule } from "./tenant/tenant.module";
import { ProductModule } from "./product/product.module";
import { CustomizationTypesModule } from "./product/customization-types/customization-types.module";
import { CategoryModule } from "./category/category.module";
import { OrderModule } from "./order/order.module";
import { CustomerModule } from "./customer/customer.module";
import { CartModule } from "./cart/cart.module";
import { PaymentModule } from "./payment/payment.module";
import { AuthModule } from "./auth/auth.module";
import { MailModule } from "./mail/mail.module";
import { ShippingModule } from "./shipping/shipping.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { WishlistModule } from "./wishlist/wishlist.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { DropshippingModule } from "./dropshipping/dropshipping.module";
import { ReportModule } from "./report/report.module";
import { EventsModule } from "./events/events.module";
import { IngredientsModule } from "./bakery/ingredients/ingredients.module";
import { DecorationsModule } from "./bakery/decorations/decorations.module";
import { RecipesModule } from "./bakery/recipes/recipes.module";
import { InventoryModule } from "./bakery/inventory/inventory.module";
import { StorefrontSiteSettingsModule } from "./storefront/site-settings/site-settings.module";
import { StorefrontEventsModule } from "./storefront/events/storefront-events.module";
import { StorefrontAssetsModule } from "./storefront/assets/storefront-assets.module";
import { CouponsModule } from "./coupons/coupons.module";
import { PaymentGatewaysModule } from "./payment-gateways/payment-gateways.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { TenantContextMiddleware } from "./common/middleware/tenant-context.middleware";
import { FeatureFlagGuard } from "./common/guards/feature-flag.guard";

@Controller("_debug")
class DiagnosticController {
  @Get()
  health() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      dropshippingModule: "loaded",
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.production", ".env"],
    }) as never,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }) as never,
    EventEmitterModule.forRoot() as never,
    DatabaseModule,
    MailModule,
    AuthModule,
    TenantModule,
    ProductModule,
    CustomizationTypesModule,
    CategoryModule,
    OrderModule,
    CustomerModule,
    CartModule,
    PaymentModule,
    CheckoutModule,
    ShippingModule,
    LoyaltyModule,
    WishlistModule,
    AnalyticsModule,
    DropshippingModule,
    ReportModule,
    EventsModule,
    IngredientsModule,
    DecorationsModule,
    RecipesModule,
    InventoryModule,
    StorefrontEventsModule,
    StorefrontSiteSettingsModule,
    StorefrontAssetsModule,
    CouponsModule,
    PaymentGatewaysModule,
  ],
  controllers: [DiagnosticController],
  providers: [
    TenantContextMiddleware,
    FeatureFlagGuard,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes("*");
  }
}

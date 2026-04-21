import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { DatabaseModule } from "./database/database.module";
import { TenantModule } from "./tenant/tenant.module";
import { ProductModule } from "./product/product.module";
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
import { AdminEventsModule } from "./bakery/events/admin-events.module";
import { SiteSettingsModule } from "./bakery/site-settings/site-settings.module";
import { BakeryAssetsModule } from "./bakery/assets/bakery-assets.module";
import { TenantContextMiddleware } from "./common/middleware/tenant-context.middleware";
import { FeatureFlagGuard } from "./common/guards/feature-flag.guard";
import { TenantService } from "./tenant/tenant.service";

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
    CategoryModule,
    OrderModule,
    CustomerModule,
    CartModule,
    PaymentModule,
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
    AdminEventsModule,
    SiteSettingsModule,
    BakeryAssetsModule,
  ],
  controllers: [],
  providers: [TenantContextMiddleware, FeatureFlagGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes("*");
  }
}

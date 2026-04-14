import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";

import { DatabaseModule } from "./database/database.module";
import { TenantModule } from "./tenant/tenant.module";
import { ProductModule } from "./product/product.module";
import { CategoryModule } from "./category/category.module";
import { OrderModule } from "./order/order.module";
import { CustomerModule } from "./customer/customer.module";
import { CartModule } from "./cart/cart.module";
import { PaymentModule } from "./payment/payment.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.production", ".env"],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    DatabaseModule,
    TenantModule,
    ProductModule,
    CategoryModule,
    OrderModule,
    CustomerModule,
    CartModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

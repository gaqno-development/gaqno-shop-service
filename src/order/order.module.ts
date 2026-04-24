import { Module } from "@nestjs/common";
import { OrderService } from "./order.service";
import { OrderReadService } from "./order-read.service";
import { OrderCreateService } from "./order-create.service";
import { OrderStatusService } from "./order-status.service";
import { OrderController } from "./order.controller";
import { AuthModule } from "../auth/auth.module";
import { EventsModule } from "../events/events.module";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BakeryOrderLifecycleModule } from "../bakery/order-lifecycle/bakery-order-lifecycle.module";

@Module({
  imports: [
    AuthModule,
    EventsModule,
    BakeryOrderLifecycleModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRATION', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    OrderService,
    OrderReadService,
    OrderCreateService,
    OrderStatusService,
  ],
  controllers: [OrderController],
  exports: [OrderService, OrderCreateService],
})
export class OrderModule {}

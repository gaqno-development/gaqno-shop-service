import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { PaymentReconciliationProcessor } from "./payment-reconciliation.processor";
import { PaymentReconciliationScanner } from "./payment-reconciliation.scheduler";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { PaymentReconciliationScheduler } from "./payment-reconciliation.scheduler";
import { PaymentGatewaysModule } from "../../payment-gateways/payment-gateways.module";

const PAYMENT_RECONCILIATION_QUEUE_NAME = "payment-reconciliation";

function parseRedisUrl(redisUrl?: string) {
  if (!redisUrl) return { host: "localhost", port: 6379 };
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number.parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
  };
}

import type { DynamicModule } from "@nestjs/common";

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: PAYMENT_RECONCILIATION_QUEUE_NAME,
      useFactory: (config: ConfigService) => ({
        connection: parseRedisUrl(config.get<string>("REDIS_URL")),
      }),
      inject: [ConfigService],
    }) as DynamicModule,
    PaymentGatewaysModule,
  ],
  providers: [
    PaymentReconciliationProcessor,
    PaymentReconciliationScanner,
    PaymentReconciliationService,
    PaymentReconciliationScheduler,
  ],
  exports: [PaymentReconciliationService],
})
export class PaymentQueueModule {}

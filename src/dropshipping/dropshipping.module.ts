import { Module, OnModuleInit } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { resolveAliExpressProvider } from "./aliexpress-provider.factory";
import { DropshippingAdminController } from "./dropshipping-admin.controller";
import { DropshippingCatalogService } from "./dropshipping-catalog.service";
import { DropshippingImportService } from "./dropshipping-import.service";
import { DROPSHIPPING_TENANT_CONFIG, IMPORTED_PRODUCT_REPOSITORY } from "./dropshipping-import.types";
import { DropshippingTenantConfigRepository } from "./dropshipping-tenant-config.repository";
import { ImportedProductRepository } from "./imported-product.repository";
import { AwesomeApiFxRateFetcher } from "./pricing/awesomeapi-fx-rate-fetcher";
import { FxRateRepository } from "./pricing/fx-rate.repository";
import { FxRateService } from "./pricing/fx-rate.service";
import { FX_RATE_FETCHER, FX_RATE_REPOSITORY } from "./pricing/fx-rate.types";
import { MockSupplierProvider } from "./providers/mock/mock-supplier.provider";
import type { SupplierProviderPort } from "./providers/ports/supplier-provider.port";
import { ProviderRegistry } from "./providers/provider-registry";
import { SUPPLIER_PROVIDER_REGISTRY } from "./providers/provider-tokens";
import { OrderPlacementService } from "./queue/order-placement.service";
import {
  DROPSHIPPING_TICKET_REPOSITORY,
  ORDER_PLACEMENT_REPOSITORY,
} from "./queue/order-placement.types";
import { OrderPlacementRepository } from "./queue/order-placement.repository";
import { DropshippingTicketRepository } from "./queue/dropshipping-ticket.repository";
import {
  DropshippingQueueProducer,
  DROPSHIPPING_QUEUE_TOKEN,
} from "./queue/dropshipping-queue.producer";
import { DropshippingQueueProcessor } from "./queue/dropshipping-queue.processor";
import { PaymentApprovedListener } from "./queue/payment-approved.listener";
import {
  createDropshippingQueue,
  createNoopQueue,
  parseRedisUrl,
} from "./queue/dropshipping-queue.factory";
import { DropshippingQueueAdminService } from "./queue/dropshipping-queue-admin.service";
import { DropshippingQueueAdminController } from "./queue/dropshipping-queue-admin.controller";

const DROPSHIPPING_QUEUE_NAME = "dropshipping";

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: DROPSHIPPING_QUEUE_NAME,
      useFactory: (config: ConfigService) => ({
        connection: parseRedisUrl(config.get<string>("REDIS_URL")),
      }),
      inject: [ConfigService],
    }) as never,
  ],
  controllers: [DropshippingAdminController, DropshippingQueueAdminController],
  providers: [
    MockSupplierProvider,
    DropshippingCatalogService,
    DropshippingImportService,
    FxRateService,
    OrderPlacementService,
    DropshippingQueueProducer,
    DropshippingQueueProcessor,
    PaymentApprovedListener,
    OrderPlacementRepository,
    DropshippingTicketRepository,
    DropshippingQueueAdminService,
    {
      provide: ORDER_PLACEMENT_REPOSITORY,
      useExisting: OrderPlacementRepository,
    },
    {
      provide: DROPSHIPPING_TICKET_REPOSITORY,
      useExisting: DropshippingTicketRepository,
    },
    {
      provide: DROPSHIPPING_QUEUE_TOKEN,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>("REDIS_URL");
        if (!redisUrl) return createNoopQueue();
        return createDropshippingQueue(parseRedisUrl(redisUrl));
      },
      inject: [ConfigService],
    },
    {
      provide: SUPPLIER_PROVIDER_REGISTRY,
      useFactory: (
        config: ConfigService,
        mock: MockSupplierProvider,
      ): ProviderRegistry => {
        const env: Record<string, string | undefined> = {};
        ALIEXPRESS_ENV_KEYS.forEach((key) => {
          env[key] = config.get<string>(key);
        });
        const aliexpress = resolveAliExpressProvider(env, mock);
        const providers: readonly SupplierProviderPort[] =
          aliexpress === mock ? [mock] : [aliexpress];
        return new ProviderRegistry(providers);
      },
      inject: [ConfigService, MockSupplierProvider],
    },
    { provide: FX_RATE_REPOSITORY, useClass: FxRateRepository },
    { provide: FX_RATE_FETCHER, useClass: AwesomeApiFxRateFetcher },
    {
      provide: DROPSHIPPING_TENANT_CONFIG,
      useClass: DropshippingTenantConfigRepository,
    },
    {
      provide: IMPORTED_PRODUCT_REPOSITORY,
      useClass: ImportedProductRepository,
    },
  ],
  exports: [
    SUPPLIER_PROVIDER_REGISTRY,
    DropshippingCatalogService,
    DropshippingImportService,
    DropshippingQueueProducer,
    OrderPlacementService,
  ],
})
export class DropshippingModule implements OnModuleInit {
  onModuleInit() {
    console.log("✅ DropshippingModule initialized - routes registered at /v1/dropshipping/admin");
  }
}

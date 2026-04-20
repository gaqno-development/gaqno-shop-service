import { Test } from "@nestjs/testing";
import type {
  DropshippingOrderTicket,
  SupplierOrderRequest,
  SupplierOrderResult,
  SupplierShippingAddress,
} from "@gaqno-development/types";
import type { SupplierProviderPort } from "../providers/ports/supplier-provider.port";
import { OrderPlacementService } from "./order-placement.service";
import type {
  DropshippingOrderSnapshot,
  DropshippingTicketRepositoryPort,
  OpenTicketInput,
  OrderPlacementRepositoryPort,
} from "./order-placement.types";
import {
  DROPSHIPPING_TICKET_REPOSITORY,
  ORDER_PLACEMENT_REPOSITORY,
} from "./order-placement.types";
import { SUPPLIER_PROVIDER_REGISTRY } from "../providers/provider-tokens";
import type { ProviderRegistry } from "../providers/provider-registry";

const TENANT_ID = "tenant-1";
const ORDER_ID = "order-1";

const ADDRESS: SupplierShippingAddress = {
  fullName: "John Buyer",
  phone: "+55 11 99999-9999",
  email: "john@example.com",
  postalCode: "01000-000",
  street: "Rua Exemplo",
  number: "100",
  neighborhood: "Centro",
  city: "Sao Paulo",
  stateCode: "SP",
  countryCode: "BR",
};

const BASE_SNAPSHOT: DropshippingOrderSnapshot = {
  orderId: ORDER_ID,
  tenantId: TENANT_ID,
  providerCode: "aliexpress",
  externalProductId: "ali-1",
  quantity: 1,
  buyerTaxNumber: "12345678900",
  shippingAddress: ADDRESS,
  referenceId: "REF-1",
  fulfillmentStatus: "queued",
};

function createRepo(
  snapshot: DropshippingOrderSnapshot | undefined,
): jest.Mocked<OrderPlacementRepositoryPort> {
  return {
    findSnapshot: jest.fn().mockResolvedValue(snapshot),
    markPlacing: jest.fn().mockResolvedValue(undefined),
    markPlaced: jest.fn().mockResolvedValue(undefined),
    markOnHold: jest.fn().mockResolvedValue(undefined),
  };
}

function createRepoWithSnapshot(): jest.Mocked<OrderPlacementRepositoryPort> {
  return createRepo(BASE_SNAPSHOT);
}

function createTicketRepo(): jest.Mocked<DropshippingTicketRepositoryPort> {
  return {
    openOrUpdate: jest
      .fn<Promise<DropshippingOrderTicket>, [OpenTicketInput]>()
      .mockImplementation((input) =>
        Promise.resolve({
          id: "ticket-1",
          tenantId: input.tenantId,
          orderId: input.orderId,
          providerCode: input.providerCode,
          status: "open",
          failureReason: input.failureReason,
          failureKind: input.failureKind,
          attempts: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    markResolved: jest.fn(),
    markCancelled: jest.fn(),
    findByOrder: jest.fn().mockResolvedValue(undefined),
  };
}

function createProvider(
  result: SupplierOrderResult | Error,
): jest.Mocked<SupplierProviderPort> {
  const placeOrder = jest.fn<Promise<SupplierOrderResult>, [SupplierOrderRequest]>();
  if (result instanceof Error) {
    placeOrder.mockRejectedValue(result);
  } else {
    placeOrder.mockResolvedValue(result);
  }
  return {
    code: "aliexpress",
    search: jest.fn(),
    getDetails: jest.fn(),
    placeOrder,
    getTracking: jest.fn(),
    cancelOrder: jest.fn(),
  } as unknown as jest.Mocked<SupplierProviderPort>;
}

function createRegistry(
  provider: SupplierProviderPort,
): ProviderRegistry {
  return {
    get: () => provider,
    availableCodes: () => ["aliexpress"],
  } as unknown as ProviderRegistry;
}

async function buildService(
  provider: SupplierProviderPort,
  repo: OrderPlacementRepositoryPort,
  tickets: DropshippingTicketRepositoryPort,
) {
  const module = await Test.createTestingModule({
    providers: [
      OrderPlacementService,
      { provide: ORDER_PLACEMENT_REPOSITORY, useValue: repo },
      { provide: DROPSHIPPING_TICKET_REPOSITORY, useValue: tickets },
      { provide: SUPPLIER_PROVIDER_REGISTRY, useValue: createRegistry(provider) },
    ],
  }).compile();
  return module.get(OrderPlacementService);
}

describe("OrderPlacementService", () => {
  it("throws when order snapshot is not found", async () => {
    const repo = createRepo(undefined);
    const tickets = createTicketRepo();
    const provider = createProvider({ externalOrderId: "x", status: "placed" });
    const service = await buildService(provider, repo, tickets);

    await expect(
      service.placeOrder({
        orderId: ORDER_ID,
        tenantId: TENANT_ID,
        providerCode: "aliexpress",
        attempt: 1,
      }),
    ).rejects.toThrow(/snapshot/i);
  });

  it("marks order as placed when supplier returns placed status", async () => {
    const repo = createRepoWithSnapshot();
    const tickets = createTicketRepo();
    const provider = createProvider({
      externalOrderId: "AE-1",
      status: "placed",
      placedAt: "2026-04-20T10:00:00Z",
    });
    const service = await buildService(provider, repo, tickets);

    const outcome = await service.placeOrder({
      orderId: ORDER_ID,
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      attempt: 1,
    });

    expect(outcome.status).toBe("placed");
    expect(repo.markPlacing).toHaveBeenCalledWith(ORDER_ID, TENANT_ID);
    expect(repo.markPlaced).toHaveBeenCalledWith(
      ORDER_ID,
      TENANT_ID,
      expect.objectContaining({ externalOrderId: "AE-1" }),
    );
    expect(tickets.openOrUpdate).not.toHaveBeenCalled();
  });

  it("rethrows transient failures so BullMQ can retry without opening ticket", async () => {
    const repo = createRepoWithSnapshot();
    const tickets = createTicketRepo();
    const provider = createProvider({
      externalOrderId: "",
      status: "failed",
      failureKind: "transient",
      failureReason: "upstream timeout",
    });
    const service = await buildService(provider, repo, tickets);

    await expect(
      service.placeOrder({
        orderId: ORDER_ID,
        tenantId: TENANT_ID,
        providerCode: "aliexpress",
        attempt: 1,
      }),
    ).rejects.toThrow(/upstream timeout/);

    expect(tickets.openOrUpdate).not.toHaveBeenCalled();
    expect(repo.markOnHold).not.toHaveBeenCalled();
  });

  it("marks order on_hold and opens ticket for permanent failures", async () => {
    const repo = createRepoWithSnapshot();
    const tickets = createTicketRepo();
    const provider = createProvider({
      externalOrderId: "",
      status: "failed",
      failureKind: "out_of_stock",
      failureReason: "SKU esgotado",
    });
    const service = await buildService(provider, repo, tickets);

    const outcome = await service.placeOrder({
      orderId: ORDER_ID,
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      attempt: 1,
    });

    expect(outcome.status).toBe("on_hold");
    expect(repo.markOnHold).toHaveBeenCalledWith(
      ORDER_ID,
      TENANT_ID,
      "SKU esgotado",
    );
    expect(tickets.openOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        failureKind: "out_of_stock",
        failureReason: "SKU esgotado",
      }),
    );
  });

  it("classifies thrown unknown errors as transient and rethrows", async () => {
    const repo = createRepoWithSnapshot();
    const tickets = createTicketRepo();
    const provider = createProvider(new Error("network flaked"));
    const service = await buildService(provider, repo, tickets);

    await expect(
      service.placeOrder({
        orderId: ORDER_ID,
        tenantId: TENANT_ID,
        providerCode: "aliexpress",
        attempt: 1,
      }),
    ).rejects.toThrow(/network flaked/);

    expect(tickets.openOrUpdate).not.toHaveBeenCalled();
  });

  it("skips placement when fulfillment status is already placed", async () => {
    const repo = createRepo({
      ...BASE_SNAPSHOT,
      fulfillmentStatus: "placed",
    });
    const tickets = createTicketRepo();
    const provider = createProvider({
      externalOrderId: "should-not-be-called",
      status: "placed",
    });
    const service = await buildService(provider, repo, tickets);

    const outcome = await service.placeOrder({
      orderId: ORDER_ID,
      tenantId: TENANT_ID,
      providerCode: "aliexpress",
      attempt: 1,
    });

    expect(outcome.status).toBe("skipped");
    expect(provider.placeOrder).not.toHaveBeenCalled();
    expect(repo.markPlacing).not.toHaveBeenCalled();
  });
});

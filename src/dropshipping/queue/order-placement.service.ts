import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  DropshippingQueueJobPayload,
  SupplierOrderFailureKind,
  SupplierOrderResult,
} from "@gaqno-development/types";
import type { ProviderRegistry } from "../providers/provider-registry";
import { SUPPLIER_PROVIDER_REGISTRY } from "../providers/provider-tokens";
import type { SupplierProviderPort } from "../providers/ports/supplier-provider.port";
import {
  DROPSHIPPING_TICKET_REPOSITORY,
  ORDER_PLACEMENT_REPOSITORY,
  buildSupplierRequest,
  isTransientFailure,
  type DropshippingOrderSnapshot,
  type DropshippingTicketRepositoryPort,
  type OrderPlacementRepositoryPort,
} from "./order-placement.types";

export type PlacementOutcomeStatus = "placed" | "on_hold" | "skipped";

export interface PlacementOutcome {
  readonly status: PlacementOutcomeStatus;
  readonly externalOrderId?: string;
  readonly failureReason?: string;
  readonly failureKind?: SupplierOrderFailureKind;
}

export class TransientPlacementError extends Error {
  constructor(
    readonly orderId: string,
    readonly failureKind: SupplierOrderFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "TransientPlacementError";
  }
}

@Injectable()
export class OrderPlacementService {
  constructor(
    @Inject(ORDER_PLACEMENT_REPOSITORY)
    private readonly orders: OrderPlacementRepositoryPort,
    @Inject(DROPSHIPPING_TICKET_REPOSITORY)
    private readonly tickets: DropshippingTicketRepositoryPort,
    @Inject(SUPPLIER_PROVIDER_REGISTRY)
    private readonly registry: ProviderRegistry,
  ) {}

  async placeOrder(job: DropshippingQueueJobPayload): Promise<PlacementOutcome> {
    const snapshot = await this.loadSnapshot(job);
    if (snapshot.fulfillmentStatus === "placed") {
      return { status: "skipped" };
    }

    const provider = this.resolveProvider(snapshot.providerCode);
    await this.orders.markPlacing(snapshot.orderId, snapshot.tenantId);

    const result = await this.callSupplier(provider, snapshot);
    return this.handleResult(snapshot, result);
  }

  private async loadSnapshot(
    job: DropshippingQueueJobPayload,
  ): Promise<DropshippingOrderSnapshot> {
    const snapshot = await this.orders.findSnapshot(job.orderId, job.tenantId);
    if (!snapshot) {
      throw new NotFoundException(
        `No dropshipping snapshot for order ${job.orderId}`,
      );
    }
    return snapshot;
  }

  private resolveProvider(code: string): SupplierProviderPort {
    const available = this.registry.availableCodes();
    if (!available.includes(code as (typeof available)[number])) {
      throw new Error(`Unknown provider code "${code}"`);
    }
    return this.registry.get(code as (typeof available)[number]);
  }

  private async callSupplier(
    provider: SupplierProviderPort,
    snapshot: DropshippingOrderSnapshot,
  ): Promise<SupplierOrderResult> {
    try {
      return await provider.placeOrder(buildSupplierRequest(snapshot));
    } catch (error) {
      throw new TransientPlacementError(
        snapshot.orderId,
        "transient",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async handleResult(
    snapshot: DropshippingOrderSnapshot,
    result: SupplierOrderResult,
  ): Promise<PlacementOutcome> {
    if (result.status === "placed") {
      await this.orders.markPlaced(snapshot.orderId, snapshot.tenantId, result);
      return { status: "placed", externalOrderId: result.externalOrderId };
    }
    const kind: SupplierOrderFailureKind = result.failureKind ?? "unknown";
    const reason = result.failureReason ?? "unknown supplier failure";
    if (isTransientFailure(kind)) {
      throw new TransientPlacementError(snapshot.orderId, kind, reason);
    }
    await this.openOnHold(snapshot, kind, reason);
    return { status: "on_hold", failureKind: kind, failureReason: reason };
  }

  private async openOnHold(
    snapshot: DropshippingOrderSnapshot,
    failureKind: SupplierOrderFailureKind,
    failureReason: string,
  ): Promise<void> {
    await this.orders.markOnHold(
      snapshot.orderId,
      snapshot.tenantId,
      failureReason,
    );
    await this.tickets.openOrUpdate({
      tenantId: snapshot.tenantId,
      orderId: snapshot.orderId,
      providerCode: snapshot.providerCode,
      failureReason,
      failureKind,
    });
  }
}

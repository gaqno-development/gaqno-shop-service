import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { tenantPaymentGateways } from "../database/schema/tenant";
import { PaymentProvider } from "./payment-gateway.interface";
import { PaymentGatewayFactory } from "./payment-gateway.factory";

interface BootstrapInput {
  readonly tenantId: string;
  readonly provider: PaymentProvider;
}

interface UpsertCredentialsInput {
  readonly tenantId: string;
  readonly provider: PaymentProvider;
  readonly credentials: Record<string, unknown>;
  readonly isActive?: boolean;
}

@Injectable()
export class PaymentGatewaysService {
  constructor(
    @Inject("DATABASE") private readonly db: any,
    private readonly factory: PaymentGatewayFactory
  ) {}

  async listForTenant(tenantId: string) {
    return this.db
      .select()
      .from(tenantPaymentGateways)
      .where(eq(tenantPaymentGateways.tenantId, tenantId));
  }

  async bootstrap(input: BootstrapInput) {
    const existing = await this.db
      .select()
      .from(tenantPaymentGateways)
      .where(
        and(
          eq(tenantPaymentGateways.tenantId, input.tenantId),
          eq(tenantPaymentGateways.provider, input.provider)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      return { id: existing[0].id, reused: true };
    }

    const [created] = await this.db
      .insert(tenantPaymentGateways)
      .values({
        tenantId: input.tenantId,
        provider: input.provider,
        credentials: {},
        isActive: false,
        isDefault: true,
      })
      .returning();
    return { id: created.id, reused: false };
  }

  async upsertCredentials(input: UpsertCredentialsInput) {
    const gateway = this.factory.get(input.provider);
    const validation = await gateway.validateCredentials({
      credentials: input.credentials,
    });

    const existing = await this.db
      .select()
      .from(tenantPaymentGateways)
      .where(
        and(
          eq(tenantPaymentGateways.tenantId, input.tenantId),
          eq(tenantPaymentGateways.provider, input.provider)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      const [created] = await this.db
        .insert(tenantPaymentGateways)
        .values({
          tenantId: input.tenantId,
          provider: input.provider,
          credentials: input.credentials,
          isActive: input.isActive ?? validation.valid,
          isDefault: true,
        })
        .returning();
      return { gateway: created, validation };
    }

    const [updated] = await this.db
      .update(tenantPaymentGateways)
      .set({
        credentials: input.credentials,
        isActive: input.isActive ?? validation.valid,
        updatedAt: new Date(),
      })
      .where(eq(tenantPaymentGateways.id, existing[0].id))
      .returning();
    return { gateway: updated, validation };
  }

  async remove(tenantId: string, id: string) {
    const [deleted] = await this.db
      .delete(tenantPaymentGateways)
      .where(
        and(
          eq(tenantPaymentGateways.id, id),
          eq(tenantPaymentGateways.tenantId, tenantId)
        )
      )
      .returning();
    if (!deleted) {
      throw new NotFoundException(`Gateway ${id} not found for tenant`);
    }
  }
}

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { tenantFeatureFlags, tenantPaymentGateways } from "../database/schema/tenant";
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

interface ResolvedTenantGateway {
  readonly id: string;
  readonly tenantId: string;
  readonly provider: PaymentProvider;
  readonly credentials: Record<string, unknown>;
  readonly isActive: boolean | null;
  readonly isDefault: boolean | null;
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

  async getPreferredGatewayForTenant(
    tenantId: string,
    provider?: PaymentProvider,
  ): Promise<ResolvedTenantGateway | null> {
    const rows = await this.db
      .select()
      .from(tenantPaymentGateways)
      .where(
        provider
          ? and(
              eq(tenantPaymentGateways.tenantId, tenantId),
              eq(tenantPaymentGateways.provider, provider),
            )
          : eq(tenantPaymentGateways.tenantId, tenantId),
      );
    const active = rows.filter((row: any) => row.isActive);
    const scoped = active.length > 0 ? active : rows;
    const preferred = scoped.find((row: any) => row.isDefault) ?? scoped[0];
    if (!preferred) return null;
    return preferred as ResolvedTenantGateway;
  }

  async getGatewayById(id: string): Promise<ResolvedTenantGateway | null> {
    const rows = await this.db
      .select()
      .from(tenantPaymentGateways)
      .where(eq(tenantPaymentGateways.id, id))
      .limit(1);
    const gateway = rows[0];
    return gateway ? (gateway as ResolvedTenantGateway) : null;
  }

  async getEnabledPaymentMethods(tenantId: string): Promise<string[]> {
    const gateway = await this.getPreferredGatewayForTenant(
      tenantId,
      "mercado_pago",
    );
    if (!gateway?.isActive) return [];
    const flags = await this.db.query.tenantFeatureFlags.findFirst({
      where: eq(tenantFeatureFlags.tenantId, tenantId),
    });
    const checkoutProOn = flags?.featureCheckoutPro !== false;
    const pixOn = flags?.featurePix !== false;
    const methods: string[] = [];
    if (checkoutProOn) {
      methods.push("credit_card");
    }
    if (pixOn) {
      methods.push("pix");
    }
    if (checkoutProOn) {
      methods.push("boleto");
    }
    return methods;
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

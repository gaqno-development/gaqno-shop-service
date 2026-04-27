import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { orders } from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import { PaymentGatewaysService } from "../../payment-gateways/payment-gateways.service";
import { PaymentGatewayFactory } from "../../payment-gateways/payment-gateway.factory";
import type { GatewayCredentials } from "../../payment-gateways/payment-gateway.interface";
import type { PaymentReconciliationJobPayload } from "./payment-reconciliation.types";

const PAID_STATUSES = new Set(["approved", "authorized"]);

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly paymentGatewaysService: PaymentGatewaysService,
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
  ) {}

  async reconcile(payload: PaymentReconciliationJobPayload): Promise<{
    status: "approved" | "still_pending" | "rejected" | "error";
    orderNumber: string;
  }> {
    const { orderId, orderNumber, tenantId, paymentExternalId } = payload;

    try {
      const gateway = await this.paymentGatewaysService.getPreferredGatewayForTenant(
        tenantId,
        "mercado_pago",
      );
      const accessToken = gateway?.credentials?.access_token;
      if (!accessToken || typeof accessToken !== "string") {
        this.logger.warn(`Payment gateway not configured for tenant ${tenantId}`);
        return { status: "error", orderNumber };
      }

      const credentials = gateway.credentials as GatewayCredentials;
      const mp = this.paymentGatewayFactory.get("mercado_pago");
      const paymentInfo = await mp.getPaymentStatus(paymentExternalId, credentials);

      if (PAID_STATUSES.has(paymentInfo.status)) {
        await this.db
          .update(orders)
          .set({
            paymentStatus: paymentInfo.status === "authorized" ? "authorized" : "approved",
            paidAt: new Date(),
            webhookLastReceivedAt: new Date(),
          })
          .where(eq(orders.id, orderId));

        this.logger.log(`Order ${orderNumber} reconciled as ${paymentInfo.status}`);
        return { status: "approved", orderNumber };
      }

      if (paymentInfo.status === "rejected" || paymentInfo.status === "cancelled") {
        await this.db
          .update(orders)
          .set({
            paymentStatus: paymentInfo.status,
            paymentFailureReason: paymentInfo.statusDetail ?? "Payment rejected",
            webhookLastReceivedAt: new Date(),
          })
          .where(eq(orders.id, orderId));

        this.logger.log(`Order ${orderNumber} reconciled as ${paymentInfo.status}`);
        return { status: "rejected", orderNumber };
      }

      this.logger.debug(`Order ${orderNumber} still pending on MP`);
      return { status: "still_pending", orderNumber };
    } catch (err) {
      this.logger.error(
        `Failed to reconcile order ${orderNumber}: ${err instanceof Error ? err.message : err}`,
      );
      return { status: "error", orderNumber };
    }
  }
}

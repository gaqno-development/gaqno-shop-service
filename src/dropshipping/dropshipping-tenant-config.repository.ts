import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { dropshippingProviders } from "../database/schema";
import type { ShopDatabase } from "../database/shop-database.type";
import type {
  DropshippingTenantConfig,
  DropshippingTenantConfigPort,
} from "./dropshipping-import.types";
import type { PsychologicalRounding } from "./pricing/margin-calculator";

const ROUNDING_VALUES: readonly PsychologicalRounding[] = [
  "none",
  "ninety",
  "ninety_nine",
];

@Injectable()
export class DropshippingTenantConfigRepository
  implements DropshippingTenantConfigPort
{
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async getConfig(tenantId: string): Promise<DropshippingTenantConfig> {
    const rows = await this.db
      .select()
      .from(dropshippingProviders)
      .where(
        and(
          eq(dropshippingProviders.tenantId, tenantId),
          eq(dropshippingProviders.isActive, true),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(
        `No active dropshipping provider configured for tenant ${tenantId}`,
      );
    }
    return {
      tenantId: row.tenantId,
      providerCode: row.providerCode,
      defaultMarginPercent: parseFloat(row.defaultMarginPercent),
      rounding: toRounding(row.roundingRule),
    };
  }
}

function toRounding(value: string | null): PsychologicalRounding {
  if (value && (ROUNDING_VALUES as readonly string[]).includes(value)) {
    return value as PsychologicalRounding;
  }
  return "none";
}

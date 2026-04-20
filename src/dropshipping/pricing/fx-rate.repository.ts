import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { dropshippingFxRates } from "../../database/schema";
import type { ShopDatabase } from "../../database/shop-database.type";
import type { FxRateRepositoryPort, FxRateRow } from "./fx-rate.types";

@Injectable()
export class FxRateRepository implements FxRateRepositoryPort {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findByDate(
    date: string,
    from: string,
    to: string,
  ): Promise<FxRateRow | undefined> {
    const rows = await this.db
      .select()
      .from(dropshippingFxRates)
      .where(
        and(
          eq(dropshippingFxRates.rateDate, date),
          eq(dropshippingFxRates.currencyFrom, from),
          eq(dropshippingFxRates.currencyTo, to),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findMostRecent(
    from: string,
    to: string,
  ): Promise<FxRateRow | undefined> {
    const rows = await this.db
      .select()
      .from(dropshippingFxRates)
      .where(
        and(
          eq(dropshippingFxRates.currencyFrom, from),
          eq(dropshippingFxRates.currencyTo, to),
        ),
      )
      .orderBy(desc(dropshippingFxRates.rateDate))
      .limit(1);
    return rows[0];
  }

  async upsert(row: FxRateRow): Promise<void> {
    await this.db
      .insert(dropshippingFxRates)
      .values(row)
      .onConflictDoUpdate({
        target: [
          dropshippingFxRates.rateDate,
          dropshippingFxRates.currencyFrom,
          dropshippingFxRates.currencyTo,
        ],
        set: { rate: row.rate, source: row.source },
      });
  }
}

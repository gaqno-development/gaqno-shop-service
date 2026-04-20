import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  FX_RATE_FETCHER,
  FX_RATE_REPOSITORY,
  type FxRateFetcherPort,
  type FxRateRepositoryPort,
} from "./fx-rate.types";

export type ClockFn = () => Date;

export const DEFAULT_CLOCK: ClockFn = () => new Date();

export const FX_RATE_CLOCK = Symbol("FX_RATE_CLOCK");

@Injectable()
export class FxRateService {
  private readonly clock: ClockFn;

  constructor(
    @Inject(FX_RATE_REPOSITORY)
    private readonly repo: FxRateRepositoryPort,
    @Inject(FX_RATE_FETCHER)
    private readonly fetcher: FxRateFetcherPort,
    @Optional()
    @Inject(FX_RATE_CLOCK)
    clock?: ClockFn,
  ) {
    this.clock = clock ?? DEFAULT_CLOCK;
  }

  async getRate(from: string, to: string): Promise<number> {
    const currencyFrom = from.toUpperCase();
    const currencyTo = to.toUpperCase();
    const today = formatDate(this.clock());

    const cached = await this.repo.findByDate(today, currencyFrom, currencyTo);
    if (cached) return parseRate(cached.rate);

    try {
      const fresh = await this.fetcher.fetch(currencyFrom, currencyTo);
      await this.repo.upsert({
        rateDate: today,
        currencyFrom,
        currencyTo,
        rate: fresh.rate.toString(),
        source: fresh.source,
      });
      return fresh.rate;
    } catch (error) {
      const fallback = await this.repo.findMostRecent(currencyFrom, currencyTo);
      if (fallback) return parseRate(fallback.rate);
      throw new Error(
        `Unable to resolve FX rate ${currencyFrom}->${currencyTo}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function formatDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseRate(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid cached rate: ${raw}`);
  }
  return n;
}

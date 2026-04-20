import { FxRateService } from "./fx-rate.service";
import { MockFxRateFetcher } from "./mock-fx-rate-fetcher";
import type { FxRateRepositoryPort, FxRateRow } from "./fx-rate.types";

function createRepo(): FxRateRepositoryPort & {
  rows: FxRateRow[];
} {
  const rows: FxRateRow[] = [];
  return {
    rows,
    async findByDate(date, from, to) {
      return rows.find(
        (r) =>
          r.rateDate === date &&
          r.currencyFrom === from &&
          r.currencyTo === to,
      );
    },
    async findMostRecent(from, to) {
      const matches = rows.filter(
        (r) => r.currencyFrom === from && r.currencyTo === to,
      );
      return matches.sort((a, b) => (a.rateDate < b.rateDate ? 1 : -1))[0];
    },
    async upsert(row) {
      const idx = rows.findIndex(
        (r) =>
          r.rateDate === row.rateDate &&
          r.currencyFrom === row.currencyFrom &&
          r.currencyTo === row.currencyTo,
      );
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
    },
  };
}

describe("FxRateService", () => {
  const FIXED_DATE = new Date("2026-04-20T12:00:00Z");
  const clock = () => FIXED_DATE;

  it("fetches and caches when no rate exists for the day", async () => {
    const repo = createRepo();
    const fetcher = new MockFxRateFetcher();
    fetcher.setNext({ rate: 5.42, source: "awesomeapi" });
    const service = new FxRateService(repo, fetcher, clock);

    const rate = await service.getRate("USD", "BRL");

    expect(rate).toBe(5.42);
    expect(fetcher.callCount()).toBe(1);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({
      rateDate: "2026-04-20",
      currencyFrom: "USD",
      currencyTo: "BRL",
      rate: "5.42",
      source: "awesomeapi",
    });
  });

  it("returns cached rate without calling fetcher when same-day row exists", async () => {
    const repo = createRepo();
    repo.rows.push({
      rateDate: "2026-04-20",
      currencyFrom: "USD",
      currencyTo: "BRL",
      rate: "5.10",
      source: "cached",
    });
    const fetcher = new MockFxRateFetcher();
    const service = new FxRateService(repo, fetcher, clock);

    const rate = await service.getRate("USD", "BRL");

    expect(rate).toBe(5.1);
    expect(fetcher.callCount()).toBe(0);
  });

  it("normalizes currency codes to uppercase", async () => {
    const repo = createRepo();
    const fetcher = new MockFxRateFetcher();
    const service = new FxRateService(repo, fetcher, clock);

    await service.getRate("usd", "brl");

    expect(fetcher.lastCall()).toEqual({ from: "USD", to: "BRL" });
  });

  it("falls back to most recent cached rate when fetcher fails", async () => {
    const repo = createRepo();
    repo.rows.push({
      rateDate: "2026-04-19",
      currencyFrom: "USD",
      currencyTo: "BRL",
      rate: "5.00",
      source: "stale",
    });
    const fetcher = new MockFxRateFetcher();
    jest.spyOn(fetcher, "fetch").mockRejectedValueOnce(new Error("network"));
    const service = new FxRateService(repo, fetcher, clock);

    const rate = await service.getRate("USD", "BRL");

    expect(rate).toBe(5);
  });

  it("throws when no cache and fetcher fails", async () => {
    const repo = createRepo();
    const fetcher = new MockFxRateFetcher();
    jest.spyOn(fetcher, "fetch").mockRejectedValueOnce(new Error("network"));
    const service = new FxRateService(repo, fetcher, clock);

    await expect(service.getRate("USD", "BRL")).rejects.toThrow(/fx rate/i);
  });
});

import { Test } from "@nestjs/testing";
import { FX_RATE_FETCHER, FX_RATE_REPOSITORY } from "./fx-rate.types";

describe("FxRateService Nest DI", () => {
  it("should be resolvable by Nest with only repo + fetcher registered (clock is optional)", async () => {
    const repo = createRepo();
    const fetcher = new MockFxRateFetcher();

    const moduleRef = await Test.createTestingModule({
      providers: [
        FxRateService,
        { provide: FX_RATE_REPOSITORY, useValue: repo },
        { provide: FX_RATE_FETCHER, useValue: fetcher },
      ],
    }).compile();

    const service = moduleRef.get(FxRateService);
    expect(service).toBeInstanceOf(FxRateService);
  });
});

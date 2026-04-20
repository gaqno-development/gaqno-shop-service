export interface FxRateSnapshot {
  readonly rate: number;
  readonly source: string;
}

export interface FxRateFetcherPort {
  fetch(from: string, to: string): Promise<FxRateSnapshot>;
}

export const FX_RATE_FETCHER = Symbol("FX_RATE_FETCHER");

export interface FxRateRow {
  readonly rateDate: string;
  readonly currencyFrom: string;
  readonly currencyTo: string;
  readonly rate: string;
  readonly source: string;
}

export interface FxRateRepositoryPort {
  findByDate(
    date: string,
    from: string,
    to: string,
  ): Promise<FxRateRow | undefined>;
  findMostRecent(from: string, to: string): Promise<FxRateRow | undefined>;
  upsert(row: FxRateRow): Promise<void>;
}

export const FX_RATE_REPOSITORY = Symbol("FX_RATE_REPOSITORY");

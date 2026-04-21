export const LOW_STOCK_THRESHOLD = 10;
export const CRITICAL_STOCK_THRESHOLD = 3;
export const DEFAULT_RANGE_DAYS = 30;

export interface DateRange {
  readonly start: Date;
  readonly end: Date;
}

export function parseDateRange(
  startDate?: string,
  endDate?: string,
  defaultDays = DEFAULT_RANGE_DAYS,
): DateRange {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

import type { FxRateFetcherPort } from "./fx-rate.types";

export interface MockFxRate {
  readonly rate: number;
  readonly source: string;
}

export class MockFxRateFetcher implements FxRateFetcherPort {
  private next: MockFxRate = { rate: 5.25, source: "mock" };
  private readonly calls: { from: string; to: string }[] = [];

  setNext(rate: MockFxRate): void {
    this.next = rate;
  }

  async fetch(from: string, to: string): Promise<MockFxRate> {
    this.calls.push({ from, to });
    return this.next;
  }

  callCount(): number {
    return this.calls.length;
  }

  lastCall(): { from: string; to: string } | undefined {
    return this.calls[this.calls.length - 1];
  }
}

import { Injectable } from "@nestjs/common";
import axios from "axios";
import type { FxRateFetcherPort, FxRateSnapshot } from "./fx-rate.types";

const AWESOME_API_URL = "https://economia.awesomeapi.com.br/last";

interface AwesomeApiEntry {
  readonly bid: string;
}

type AwesomeApiResponse = Record<string, AwesomeApiEntry>;

@Injectable()
export class AwesomeApiFxRateFetcher implements FxRateFetcherPort {
  async fetch(from: string, to: string): Promise<FxRateSnapshot> {
    const response = await axios.get<AwesomeApiResponse>(
      `${AWESOME_API_URL}/${from}-${to}`,
      { timeout: 5000 },
    );
    const key = `${from}${to}`;
    const entry = response.data[key];
    if (!entry?.bid) {
      throw new Error(`awesomeapi missing bid for ${from}->${to}`);
    }
    const rate = parseFloat(entry.bid);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`awesomeapi invalid bid: ${entry.bid}`);
    }
    return { rate, source: "awesomeapi" };
  }
}

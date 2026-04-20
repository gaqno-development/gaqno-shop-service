import nock from "nock";
import { AwesomeApiFxRateFetcher } from "./awesomeapi-fx-rate-fetcher";

describe("AwesomeApiFxRateFetcher", () => {
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.restore());

  it("parses bid value for USD-BRL", async () => {
    nock("https://economia.awesomeapi.com.br")
      .get("/last/USD-BRL")
      .reply(200, { USDBRL: { bid: "5.4321" } });

    const fetcher = new AwesomeApiFxRateFetcher();
    const result = await fetcher.fetch("USD", "BRL");

    expect(result).toEqual({ rate: 5.4321, source: "awesomeapi" });
  });

  it("throws when bid is missing", async () => {
    nock("https://economia.awesomeapi.com.br")
      .get("/last/USD-BRL")
      .reply(200, {});

    const fetcher = new AwesomeApiFxRateFetcher();
    await expect(fetcher.fetch("USD", "BRL")).rejects.toThrow(/missing bid/);
  });

  it("throws when bid is not a positive number", async () => {
    nock("https://economia.awesomeapi.com.br")
      .get("/last/USD-BRL")
      .reply(200, { USDBRL: { bid: "zero" } });

    const fetcher = new AwesomeApiFxRateFetcher();
    await expect(fetcher.fetch("USD", "BRL")).rejects.toThrow(/invalid bid/);
  });
});

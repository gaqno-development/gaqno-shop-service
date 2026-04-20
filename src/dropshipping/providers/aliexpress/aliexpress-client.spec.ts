import nock from "nock";
import { AliExpressClient } from "./aliexpress-client";

const CONFIG = {
  appKey: "APP",
  appSecret: "SECRET",
  baseUrl: "https://api.mock-ali.test",
  requestTimeoutMs: 5000,
};

function parseForm(raw: unknown): Record<string, string> {
  const params = new URLSearchParams(String(raw));
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

describe("AliExpressClient", () => {
  let client: AliExpressClient;

  beforeEach(() => {
    client = new AliExpressClient(CONFIG);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  it("signs every request with required system params and returns result body", async () => {
    const scope = nock(CONFIG.baseUrl)
      .post("/sync")
      .reply(200, {
        resp_result: {
          resp_code: 200,
          resp_msg: "ok",
          result: { total_count: 0, current_page_no: 1, page_size: 10, products: [] },
        },
      });

    const result = await client.call({
      method: "aliexpress.ds.product.search",
      params: { keyword: "shoe" },
    });

    expect(scope.isDone()).toBe(true);
    expect(result).toEqual({
      total_count: 0,
      current_page_no: 1,
      page_size: 10,
      products: [],
    });
  });

  it("includes all required system parameters and a 64-char sign", async () => {
    let body: Record<string, string> = {};
    nock(CONFIG.baseUrl)
      .post("/sync")
      .reply(function (_uri, requestBody) {
        body = parseForm(requestBody);
        return [
          200,
          {
            resp_result: {
              resp_code: 200,
              resp_msg: "ok",
              result: { total_count: 0, current_page_no: 1, page_size: 10, products: [] },
            },
          },
        ];
      });

    await client.call({
      method: "aliexpress.ds.product.search",
      params: { keyword: "shoe" },
    });

    expect(body).toMatchObject({
      app_key: "APP",
      method: "aliexpress.ds.product.search",
      format: "json",
      sign_method: "hmac-sha256",
      v: "2.0",
      keyword: "shoe",
    });
    expect(body.sign).toHaveLength(64);
    expect(body.timestamp).toBeTruthy();
  });

  it("throws AliExpressApiError when response contains error_response envelope", async () => {
    nock(CONFIG.baseUrl)
      .post("/sync")
      .reply(200, {
        error_response: {
          code: 25,
          msg: "Invalid signature",
          sub_code: "isv.invalid-signature",
        },
      });

    await expect(
      client.call({
        method: "aliexpress.ds.product.search",
        params: {},
      }),
    ).rejects.toMatchObject({
      name: "AliExpressApiError",
      code: "25",
      subCode: "isv.invalid-signature",
    });
  });

  it("throws on HTTP error status", async () => {
    nock(CONFIG.baseUrl).post("/sync").reply(500, "boom");

    await expect(
      client.call({
        method: "aliexpress.ds.product.search",
        params: {},
      }),
    ).rejects.toThrow(/http 500/i);
  });
});

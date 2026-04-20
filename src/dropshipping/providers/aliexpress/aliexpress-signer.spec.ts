import {
  buildSignBase,
  normalizeParams,
  signRequest,
} from "./aliexpress-signer";

describe("aliexpress-signer", () => {
  describe("normalizeParams", () => {
    it("drops undefined values and stringifies numbers and booleans", () => {
      const normalized = normalizeParams({
        keyword: "shoe",
        minPrice: 10,
        active: true,
        removeMe: undefined,
      });

      expect(normalized).toEqual({
        keyword: "shoe",
        minPrice: "10",
        active: "true",
      });
    });

    it("sorts keys alphabetically", () => {
      const normalized = normalizeParams({
        zebra: "1",
        alpha: "2",
        beta: "3",
      });

      expect(Object.keys(normalized)).toEqual(["alpha", "beta", "zebra"]);
    });
  });

  describe("buildSignBase", () => {
    it("prepends API path and concatenates key+value pairs without separators", () => {
      const base = buildSignBase("/api/method", {
        app_key: "APP",
        timestamp: "2026-04-20 12:00:00",
        method: "aliexpress.ds.product.search",
      });

      expect(base).toBe(
        "/api/methodapp_keyAPPmethodaliexpress.ds.product.searchtimestamp2026-04-20 12:00:00",
      );
    });
  });

  describe("signRequest", () => {
    it("produces deterministic uppercase HMAC-SHA256 hex", () => {
      const signatureA = signRequest({
        apiPath: "/sync",
        params: { app_key: "k", method: "m" },
        appSecret: "s",
      });
      const signatureB = signRequest({
        apiPath: "/sync",
        params: { method: "m", app_key: "k" },
        appSecret: "s",
      });

      expect(signatureA).toBe(signatureB);
      expect(signatureA).toMatch(/^[0-9A-F]{64}$/);
    });

    it("changes when the secret changes", () => {
      const a = signRequest({
        apiPath: "/sync",
        params: { app_key: "k" },
        appSecret: "s1",
      });
      const b = signRequest({
        apiPath: "/sync",
        params: { app_key: "k" },
        appSecret: "s2",
      });
      expect(a).not.toBe(b);
    });

    it("changes when any parameter value changes", () => {
      const a = signRequest({
        apiPath: "/sync",
        params: { app_key: "k", method: "m" },
        appSecret: "s",
      });
      const b = signRequest({
        apiPath: "/sync",
        params: { app_key: "k", method: "n" },
        appSecret: "s",
      });
      expect(a).not.toBe(b);
    });
  });
});

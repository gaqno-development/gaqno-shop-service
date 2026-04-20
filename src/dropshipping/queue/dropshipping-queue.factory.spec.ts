import {
  createNoopQueue,
  parseRedisUrl,
} from "./dropshipping-queue.factory";

describe("dropshipping queue factory", () => {
  describe("parseRedisUrl", () => {
    it("returns defaults when url is undefined", () => {
      expect(parseRedisUrl(undefined)).toEqual({ host: "localhost", port: 6379 });
    });

    it("parses redis url with password and db", () => {
      const result = parseRedisUrl("redis://:secret@redis.host:6380/2");
      expect(result).toEqual({
        host: "redis.host",
        port: 6380,
        password: "secret",
        db: 2,
      });
    });

    it("defaults db to 0 when path is empty", () => {
      const result = parseRedisUrl("redis://redis.host:6379");
      expect(result.db).toBe(0);
    });
  });

  describe("createNoopQueue", () => {
    it("add is a no-op and counts returns empty", async () => {
      const queue = createNoopQueue();
      await expect(
        queue.add("x", {
          orderId: "o",
          tenantId: "t",
          providerCode: "a",
          attempt: 1,
        }),
      ).resolves.toBeUndefined();
      await expect(queue.getJobCounts()).resolves.toEqual({});
    });
  });
});

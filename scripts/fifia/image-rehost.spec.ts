import { createImageRehoster } from "./image-rehost";

describe("createImageRehoster", () => {
  it("rehosts a fresh url: fetches bytes, uploads to R2, returns public url, and records idempotency map", async () => {
    const seen = new Map<string, string>();
    const puts: Array<{ key: string; bytes: number; contentType: string }> = [];
    const rehoster = createImageRehoster({
      tenantSlug: "fifia-doces",
      publicBase: "https://media.gaqno.com.br",
      lookup: async (src) => seen.get(src) ?? null,
      remember: async (src, url) => {
        seen.set(src, url);
      },
      fetcher: async (url) => ({
        bytes: Buffer.from([1, 2, 3]),
        contentType: "image/webp",
        sourceUrl: url,
      }),
      uploader: async (key, bytes, contentType) => {
        puts.push({ key, bytes: bytes.length, contentType });
      },
    });
    const result = await rehoster.rehost({
      entity: "product",
      sourceId: "p1",
      url: "https://fifia-old.example.com/img/a.webp",
    });
    expect(result).toBe("https://media.gaqno.com.br/fifia-doces/product/p1.webp");
    expect(puts).toEqual([
      {
        key: "fifia-doces/product/p1.webp",
        bytes: 3,
        contentType: "image/webp",
      },
    ]);
    expect(seen.get("https://fifia-old.example.com/img/a.webp")).toBe(
      "https://media.gaqno.com.br/fifia-doces/product/p1.webp",
    );
  });

  it("returns cached url and does not re-upload when already known", async () => {
    const puts: string[] = [];
    const rehoster = createImageRehoster({
      tenantSlug: "fifia-doces",
      publicBase: "https://media.gaqno.com.br",
      lookup: async () =>
        "https://media.gaqno.com.br/fifia-doces/product/p1.jpg",
      remember: async () => undefined,
      fetcher: async () => ({
        bytes: Buffer.alloc(0),
        contentType: "image/jpeg",
        sourceUrl: "",
      }),
      uploader: async (k) => {
        puts.push(k);
      },
    });
    const result = await rehoster.rehost({
      entity: "product",
      sourceId: "p1",
      url: "https://old/img.jpg",
    });
    expect(result).toBe(
      "https://media.gaqno.com.br/fifia-doces/product/p1.jpg",
    );
    expect(puts).toEqual([]);
  });

  it("returns null for a null/empty input url", async () => {
    const rehoster = createImageRehoster({
      tenantSlug: "fifia-doces",
      publicBase: "https://media.gaqno.com.br",
      lookup: async () => null,
      remember: async () => undefined,
      fetcher: async () => {
        throw new Error("should not fetch");
      },
      uploader: async () => {
        throw new Error("should not upload");
      },
    });
    expect(
      await rehoster.rehost({ entity: "product", sourceId: "x", url: null }),
    ).toBeNull();
    expect(
      await rehoster.rehost({ entity: "product", sourceId: "x", url: "" }),
    ).toBeNull();
  });

  it("derives extension from content-type when url has none", async () => {
    const puts: string[] = [];
    const rehoster = createImageRehoster({
      tenantSlug: "fifia-doces",
      publicBase: "https://media.gaqno.com.br",
      lookup: async () => null,
      remember: async () => undefined,
      fetcher: async () => ({
        bytes: Buffer.from([1]),
        contentType: "image/png",
        sourceUrl: "",
      }),
      uploader: async (k) => {
        puts.push(k);
      },
    });
    const result = await rehoster.rehost({
      entity: "asset",
      sourceId: "a1",
      url: "https://old/no-extension-here",
    });
    expect(result).toBe(
      "https://media.gaqno.com.br/fifia-doces/asset/a1.png",
    );
    expect(puts).toEqual(["fifia-doces/asset/a1.png"]);
  });
});

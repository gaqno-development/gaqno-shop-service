import { buildR2Key, publicUrlFromKey } from "./image-url";

describe("buildR2Key", () => {
  it("namespaces by tenant slug and entity with a deterministic hash-like segment", () => {
    const key = buildR2Key({
      tenantSlug: "fifia-doces",
      entity: "product",
      sourceId: "clproduct123",
      originalUrl: "https://cdn.fifia.com/uploads/abc.jpg",
    });
    expect(key).toBe("fifia-doces/product/clproduct123.jpg");
  });

  it("preserves png extension", () => {
    const key = buildR2Key({
      tenantSlug: "fifia-doces",
      entity: "asset",
      sourceId: "ast1",
      originalUrl: "https://x/y/z.PNG",
    });
    expect(key).toBe("fifia-doces/asset/ast1.png");
  });

  it("falls back to .bin when extension cannot be derived", () => {
    const key = buildR2Key({
      tenantSlug: "fifia-doces",
      entity: "decoration",
      sourceId: "dec1",
      originalUrl: "https://x/y/no-extension",
    });
    expect(key).toBe("fifia-doces/decoration/dec1.bin");
  });

  it("ignores query string when deriving extension", () => {
    const key = buildR2Key({
      tenantSlug: "fifia-doces",
      entity: "product",
      sourceId: "p1",
      originalUrl: "https://x/y/image.webp?v=2&token=abc",
    });
    expect(key).toBe("fifia-doces/product/p1.webp");
  });

  it("strips unsafe path segments from sourceId", () => {
    const key = buildR2Key({
      tenantSlug: "fifia-doces",
      entity: "product",
      sourceId: "../../etc/passwd",
      originalUrl: "https://x/y/a.jpg",
    });
    expect(key).toBe("fifia-doces/product/etcpasswd.jpg");
  });
});

describe("publicUrlFromKey", () => {
  it("joins bucket public base and key with single slash", () => {
    expect(
      publicUrlFromKey("https://media.gaqno.com.br", "fifia-doces/product/a.jpg"),
    ).toBe("https://media.gaqno.com.br/fifia-doces/product/a.jpg");
  });

  it("trims trailing slash on base before joining", () => {
    expect(
      publicUrlFromKey("https://media.gaqno.com.br/", "fifia-doces/a.jpg"),
    ).toBe("https://media.gaqno.com.br/fifia-doces/a.jpg");
  });

  it("trims leading slash on key before joining", () => {
    expect(
      publicUrlFromKey("https://media.gaqno.com.br", "/fifia-doces/a.jpg"),
    ).toBe("https://media.gaqno.com.br/fifia-doces/a.jpg");
  });
});

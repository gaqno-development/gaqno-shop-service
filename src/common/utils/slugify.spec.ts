import { slugify, slugifyWithSuffix } from "./slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes accents", () => {
    expect(slugify("Tênis Esportivo")).toBe("tenis-esportivo");
  });

  it("collapses multiple separators", () => {
    expect(slugify("A   b --- c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("---abc---")).toBe("abc");
  });

  it("returns empty string for symbol-only input", () => {
    expect(slugify("###")).toBe("");
  });
});

describe("slugifyWithSuffix", () => {
  it("appends suffix separated by hyphen", () => {
    expect(slugifyWithSuffix("Tênis X", "1001")).toBe("tenis-x-1001");
  });

  it("returns only the base when suffix is empty", () => {
    expect(slugifyWithSuffix("Tênis X", "")).toBe("tenis-x");
  });
});

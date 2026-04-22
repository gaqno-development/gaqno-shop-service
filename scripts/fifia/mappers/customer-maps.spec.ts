import {
  splitName,
  normalizeCep,
  normalizeUf,
  fifiaOrderNumber,
} from "./customer-maps";

describe("splitName", () => {
  it("splits a two-word full name into first and last", () => {
    expect(splitName("Maria Silva")).toEqual({
      firstName: "Maria",
      lastName: "Silva",
    });
  });

  it("joins middle names into lastName", () => {
    expect(splitName("Ana Paula dos Santos")).toEqual({
      firstName: "Ana",
      lastName: "Paula dos Santos",
    });
  });

  it("returns single word as firstName with null lastName", () => {
    expect(splitName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: null,
    });
  });

  it("handles null gracefully", () => {
    expect(splitName(null)).toEqual({ firstName: null, lastName: null });
  });

  it("trims whitespace before splitting", () => {
    expect(splitName("   João Pedro  ")).toEqual({
      firstName: "João",
      lastName: "Pedro",
    });
  });

  it("collapses internal runs of whitespace", () => {
    expect(splitName("Carlos    Roberto   Lima")).toEqual({
      firstName: "Carlos",
      lastName: "Roberto Lima",
    });
  });

  it("returns both null for empty string after trim", () => {
    expect(splitName("   ")).toEqual({ firstName: null, lastName: null });
  });
});

describe("normalizeCep", () => {
  it("formats bare 8-digit CEP with hyphen", () => {
    expect(normalizeCep("01310100")).toBe("01310-100");
  });

  it("preserves already-formatted CEP", () => {
    expect(normalizeCep("01310-100")).toBe("01310-100");
  });

  it("strips non-digit characters before formatting", () => {
    expect(normalizeCep("CEP: 04567.890")).toBe("04567-890");
  });

  it("left-pads short CEPs with zeros up to 8 digits", () => {
    expect(normalizeCep("1310100")).toBe("01310-100");
  });

  it("returns empty string for input with no digits", () => {
    expect(normalizeCep("")).toBe("");
    expect(normalizeCep("abc")).toBe("");
  });

  it("truncates inputs longer than 8 digits to the first 8", () => {
    expect(normalizeCep("013101000099")).toBe("01310-100");
  });
});

describe("normalizeUf", () => {
  it("uppercases two-letter states", () => {
    expect(normalizeUf("sp")).toBe("SP");
  });

  it("preserves already-uppercase", () => {
    expect(normalizeUf("RJ")).toBe("RJ");
  });

  it("truncates longer state names to 2 chars, uppercased", () => {
    expect(normalizeUf("São Paulo")).toBe("SÃ");
  });

  it("handles null/empty as empty string", () => {
    expect(normalizeUf(null)).toBe("");
    expect(normalizeUf("")).toBe("");
  });
});

describe("fifiaOrderNumber", () => {
  it("formats FIFIA-<last8-upper> from a cuid", () => {
    expect(fifiaOrderNumber("cjldjxqz00000abc12345678")).toBe("FIFIA-12345678");
  });

  it("uppercases mixed-case suffixes", () => {
    expect(fifiaOrderNumber("cjldjxqz00000abcDeF01234")).toBe("FIFIA-DEF01234");
  });

  it("pads short source ids with zeros on the left so the suffix stays 8 chars", () => {
    expect(fifiaOrderNumber("abc1")).toBe("FIFIA-0000ABC1");
  });

  it("throws on empty id (data integrity guard)", () => {
    expect(() => fifiaOrderNumber("")).toThrow(
      "Cannot build order number from empty source id",
    );
  });
});

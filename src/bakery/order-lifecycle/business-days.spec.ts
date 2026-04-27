import { addBusinessDays, isBeforeDate } from "../../shared/business-days";

describe("addBusinessDays", () => {
  it("adds N calendar days when all are weekdays", () => {
    const monday = new Date("2025-01-06T12:00:00Z");
    const result = addBusinessDays(monday, 2);
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-08");
  });

  it("skips weekends", () => {
    const friday = new Date("2025-01-03T12:00:00Z");
    const result = addBusinessDays(friday, 1);
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-06");
  });

  it("handles 3 business days from Thursday", () => {
    const thursday = new Date("2025-01-02T12:00:00Z");
    const result = addBusinessDays(thursday, 3);
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-07");
  });

  it("does not mutate input", () => {
    const input = new Date("2025-01-06T00:00:00Z");
    const before = input.toISOString();
    addBusinessDays(input, 5);
    expect(input.toISOString()).toBe(before);
  });
});

describe("isBeforeDate", () => {
  it("returns true when target is strictly earlier", () => {
    expect(
      isBeforeDate(new Date("2025-01-01"), new Date("2025-01-02")),
    ).toBe(true);
  });

  it("returns false when equal", () => {
    expect(
      isBeforeDate(new Date("2025-01-01"), new Date("2025-01-01")),
    ).toBe(false);
  });

  it("returns false when after", () => {
    expect(
      isBeforeDate(new Date("2025-01-03"), new Date("2025-01-02")),
    ).toBe(false);
  });
});

import {
  VERTICAL_PRESETS,
  presetForVertical,
} from "./vertical.constants";

describe("VERTICAL_PRESETS", () => {
  it("has bakery/fashion/generic", () => {
    expect(Object.keys(VERTICAL_PRESETS).sort()).toEqual([
      "bakery",
      "fashion",
      "generic",
    ]);
  });

  it("bakery has recipes and decorations", () => {
    expect(VERTICAL_PRESETS.bakery.defaultFeatures).toEqual(
      expect.arrayContaining(["recipes", "decorations"]),
    );
  });

  it("fashion has variants/sizes/colors", () => {
    expect(VERTICAL_PRESETS.fashion.defaultFeatures).toEqual(
      expect.arrayContaining(["variants", "sizes", "colors"]),
    );
  });
});

describe("presetForVertical", () => {
  it("returns bakery preset for 'bakery'", () => {
    expect(presetForVertical("bakery").layoutHint).toBe("bakery-cards");
  });

  it("falls back to generic for unknown/null vertical", () => {
    expect(presetForVertical(null).layoutHint).toBe("generic-grid");
    expect(presetForVertical("unknown").layoutHint).toBe("generic-grid");
  });
});

export type TenantVertical = string;

export const KNOWN_VERTICALS = ["bakery", "fashion", "generic"] as const;
export type KnownVertical = (typeof KNOWN_VERTICALS)[number];

export interface VerticalPreset {
  readonly layoutHint: string;
  readonly terminologyKey: string;
  readonly defaultFeatures: readonly string[];
}

export const VERTICAL_PRESETS: Readonly<Record<KnownVertical, VerticalPreset>> = {
  bakery: {
    layoutHint: "bakery-cards",
    terminologyKey: "bakery",
    defaultFeatures: [
      "recipes",
      "decorations",
      "inventory",
      "ingredients",
      "freight",
    ],
  },
  fashion: {
    layoutHint: "fashion-grid",
    terminologyKey: "fashion",
    defaultFeatures: ["variants", "sizes", "colors", "inventory"],
  },
  generic: {
    layoutHint: "generic-grid",
    terminologyKey: "generic",
    defaultFeatures: ["inventory"],
  },
};

export function presetForVertical(vertical: string | null | undefined): VerticalPreset {
  if (vertical && KNOWN_VERTICALS.includes(vertical as KnownVertical)) {
    return VERTICAL_PRESETS[vertical as KnownVertical];
  }
  return VERTICAL_PRESETS.generic;
}

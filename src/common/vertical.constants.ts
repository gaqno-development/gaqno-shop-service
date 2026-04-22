export type TenantVertical = "bakery" | "fashion" | "generic";

export interface VerticalPreset {
  readonly layoutHint: string;
  readonly terminologyKey: string;
  readonly defaultFeatures: readonly string[];
}

export const VERTICAL_PRESETS: Readonly<Record<TenantVertical, VerticalPreset>> =
  {
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
  const key = (vertical ?? "generic") as TenantVertical;
  return VERTICAL_PRESETS[key] ?? VERTICAL_PRESETS.generic;
}

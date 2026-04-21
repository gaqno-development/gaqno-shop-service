import { SetMetadata } from "@nestjs/common";

export const REQUIRE_FEATURE_KEY = "require-feature";

export type BakeryFeature =
  | "featureBakery"
  | "featureRecipes"
  | "featureDecorations"
  | "featureInventory";

export const RequireFeature = (feature: BakeryFeature) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);

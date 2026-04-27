import { SetMetadata } from "@nestjs/common";

export const REQUIRE_FEATURE_KEY = "require-feature";

export type FeatureKey = string;

export const RequireFeature = (feature: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);

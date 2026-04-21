import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FeatureFlagGuard } from "./feature-flag.guard";
import { tenantContextStorage, TenantContext } from "../tenant-context";

interface FakeFlags {
  featureBakery?: boolean;
  featureRecipes?: boolean;
  featureDecorations?: boolean;
  featureInventory?: boolean;
}

function buildTenantContext(): TenantContext {
  return {
    tenantId: "tenant-1",
    slug: "fifia",
    domain: "fifia.example",
    name: "Fifia",
    isDropshipping: false,
    orderPrefix: "FIF",
  };
}

function buildExecutionContext(): {
  getHandler: () => unknown;
  getClass: () => unknown;
} {
  const handler = () => undefined;
  class FakeClass {}
  return {
    getHandler: () => handler,
    getClass: () => FakeClass,
  };
}

function createGuard(flags: FakeFlags | null, decorated: string | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(decorated),
  } as unknown as Reflector;
  const tenantService = {
    getFeatureFlags: jest.fn().mockResolvedValue(flags),
  };
  return {
    guard: new FeatureFlagGuard(reflector, tenantService as never),
    tenantService,
  };
}

describe("FeatureFlagGuard", () => {
  it("allows routes without @RequireFeature metadata", async () => {
    const { guard } = createGuard({}, undefined);
    const ctx = buildExecutionContext();
    const result = await tenantContextStorage.run(
      buildTenantContext(),
      () => guard.canActivate(ctx as never),
    );
    expect(result).toBe(true);
  });

  it("allows when required feature is enabled for tenant", async () => {
    const { guard } = createGuard({ featureBakery: true }, "featureBakery");
    const ctx = buildExecutionContext();
    const result = await tenantContextStorage.run(
      buildTenantContext(),
      () => guard.canActivate(ctx as never),
    );
    expect(result).toBe(true);
  });

  it("throws ForbiddenException when feature is disabled", async () => {
    const { guard } = createGuard({ featureBakery: false }, "featureBakery");
    const ctx = buildExecutionContext();
    await expect(
      tenantContextStorage.run(buildTenantContext(), () =>
        guard.canActivate(ctx as never),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when tenant flags row is missing", async () => {
    const { guard } = createGuard(null, "featureBakery");
    const ctx = buildExecutionContext();
    await expect(
      tenantContextStorage.run(buildTenantContext(), () =>
        guard.canActivate(ctx as never),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when no tenant context available", async () => {
    const { guard } = createGuard({ featureBakery: true }, "featureBakery");
    const ctx = buildExecutionContext();
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

import { BadRequestException } from "@nestjs/common";
import { BakeryOrderLifecycleService } from "./bakery-order-lifecycle.service";

type Row = Record<string, unknown>;

function makeDb(store: {
  products: Row[];
  recipes: Row[];
  recipeIngredients: Row[];
  productIngredients: Row[];
}) {
  const query = {
    products: {
      findMany: jest.fn(async () => store.products),
    },
    recipes: {
      findMany: jest.fn(async () => store.recipes),
    },
    recipeIngredients: {
      findMany: jest.fn(async () => store.recipeIngredients),
    },
    productIngredients: {
      findMany: jest.fn(async () => store.productIngredients),
    },
  };
  return { query };
}

function makeTenants(flags: { featureBakery: boolean } | undefined) {
  return {
    getFeatureFlags: jest.fn(async () => flags),
  };
}

function makeInventory() {
  return {
    registerMovement: jest.fn(async () => ({ id: "mov" })),
  };
}

function createService(options: {
  flags?: { featureBakery: boolean };
  store?: Partial<{
    products: Row[];
    recipes: Row[];
    recipeIngredients: Row[];
    productIngredients: Row[];
  }>;
}) {
  const store = {
    products: options.store?.products ?? [],
    recipes: options.store?.recipes ?? [],
    recipeIngredients: options.store?.recipeIngredients ?? [],
    productIngredients: options.store?.productIngredients ?? [],
  };
  const db = makeDb(store);
  const tenants = makeTenants(options.flags);
  const inventory = makeInventory();
  const service = new BakeryOrderLifecycleService(
    db as never,
    tenants as never,
    inventory as never,
  );
  return { service, db, tenants, inventory, store };
}

describe("BakeryOrderLifecycleService.isBakeryEnabled", () => {
  it("returns true when featureBakery flag is on", async () => {
    const { service } = createService({ flags: { featureBakery: true } });
    await expect(service.isBakeryEnabled("t1")).resolves.toBe(true);
  });

  it("returns false when flag is off", async () => {
    const { service } = createService({ flags: { featureBakery: false } });
    await expect(service.isBakeryEnabled("t1")).resolves.toBe(false);
  });

  it("returns false when no flags row exists", async () => {
    const { service } = createService({ flags: undefined });
    await expect(service.isBakeryEnabled("t1")).resolves.toBe(false);
  });
});

describe("BakeryOrderLifecycleService.assertTransition", () => {
  const { service } = createService({});
  it("allows valid transitions", () => {
    expect(() => service.assertTransition("pending", "confirmed")).not.toThrow();
  });
  it("throws on invalid transitions", () => {
    expect(() => service.assertTransition("pending", "delivered")).toThrow(
      BadRequestException,
    );
  });
});

describe("BakeryOrderLifecycleService.validateLeadDaysForOrder", () => {
  it("is a no-op when bakery flag is off", async () => {
    const { service, db } = createService({ flags: { featureBakery: false } });
    await service.validateLeadDaysForOrder({
      tenantId: "t1",
      deliveryDate: new Date(),
      items: [{ productId: "p1", quantity: 1 }],
    });
    expect(db.query.products.findMany).not.toHaveBeenCalled();
  });

  it("throws when delivery date is too soon", async () => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const { service } = createService({
      flags: { featureBakery: true },
      store: {
        products: [{ id: "p1", leadDays: 5 }],
      },
    });
    await expect(
      service.validateLeadDaysForOrder({
        tenantId: "t1",
        deliveryDate: tomorrow,
        items: [{ productId: "p1", quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("succeeds when delivery date is far enough out", async () => {
    const today = new Date();
    const farAway = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
    const { service } = createService({
      flags: { featureBakery: true },
      store: {
        products: [{ id: "p1", leadDays: 2 }],
      },
    });
    await expect(
      service.validateLeadDaysForOrder({
        tenantId: "t1",
        deliveryDate: farAway,
        items: [{ productId: "p1", quantity: 1 }],
      }),
    ).resolves.toBeUndefined();
  });
});

describe("BakeryOrderLifecycleService.handleStatusChange", () => {
  it("is a no-op when bakery flag is off", async () => {
    const { service, inventory } = createService({
      flags: { featureBakery: false },
    });
    await service.handleStatusChange({
      tenantId: "t1",
      orderId: "o1",
      previous: "pending",
      next: "confirmed",
      items: [{ productId: "p1", quantity: 1 }],
    });
    expect(inventory.registerMovement).not.toHaveBeenCalled();
  });

  it("deducts recipe-based ingredients on pending → confirmed", async () => {
    const { service, inventory } = createService({
      flags: { featureBakery: true },
      store: {
        products: [{ id: "cake", recipeId: "r1" }],
        recipes: [{ id: "r1", yieldQuantity: "2" }],
        recipeIngredients: [
          { recipeId: "r1", ingredientId: "flour", quantity: "500" },
          { recipeId: "r1", ingredientId: "sugar", quantity: "200" },
        ],
      },
    });
    await service.handleStatusChange({
      tenantId: "t1",
      orderId: "o1",
      previous: "pending",
      next: "confirmed",
      items: [{ productId: "cake", quantity: 4 }],
    });
    expect(inventory.registerMovement).toHaveBeenCalledTimes(2);
    const calls = inventory.registerMovement.mock.calls.map(
      (c: unknown[]) => c[1],
    );
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ingredientId: "flour",
          quantity: "1000",
          type: "out",
          orderId: "o1",
        }),
        expect.objectContaining({
          ingredientId: "sugar",
          quantity: "400",
          type: "out",
        }),
      ]),
    );
  });

  it("deducts direct product ingredients on pending → confirmed", async () => {
    const { service, inventory } = createService({
      flags: { featureBakery: true },
      store: {
        products: [{ id: "pack", recipeId: null }],
        productIngredients: [
          { productId: "pack", ingredientId: "wrap", quantity: "2" },
        ],
      },
    });
    await service.handleStatusChange({
      tenantId: "t1",
      orderId: "o1",
      previous: "pending",
      next: "confirmed",
      items: [{ productId: "pack", quantity: 3 }],
    });
    expect(inventory.registerMovement).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        ingredientId: "wrap",
        quantity: "6",
      }),
    );
  });

  it("does not deduct on unrelated status transitions", async () => {
    const { service, inventory } = createService({
      flags: { featureBakery: true },
      store: {
        products: [{ id: "cake", recipeId: "r1" }],
      },
    });
    await service.handleStatusChange({
      tenantId: "t1",
      orderId: "o1",
      previous: "confirmed",
      next: "processing",
      items: [{ productId: "cake", quantity: 1 }],
    });
    expect(inventory.registerMovement).not.toHaveBeenCalled();
  });
});

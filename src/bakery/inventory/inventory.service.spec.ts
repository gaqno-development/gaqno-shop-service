import { NotFoundException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";

function buildDb(ingredientRow: { stock: string } | undefined) {
  const insertReturning = jest.fn().mockResolvedValue([{ id: "mv-1" }]);
  const updateWhere = jest.fn().mockResolvedValue(undefined);
  return {
    query: {
      inventoryMovements: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ingredients: {
        findFirst: jest.fn().mockResolvedValue(ingredientRow),
      },
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({ returning: insertReturning }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({ where: updateWhere }),
    }),
    _updateWhere: updateWhere,
  };
}

describe("InventoryService.registerMovement", () => {
  it("throws NotFoundException when ingredient missing", async () => {
    const db = buildDb(undefined);
    const service = new InventoryService(db as never);
    await expect(
      service.registerMovement("tenant-1", {
        ingredientId: "ing-1",
        type: "in",
        quantity: "5",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("adds quantity to stock on 'in' movement", async () => {
    const db = buildDb({ stock: "10" });
    const service = new InventoryService(db as never);
    await service.registerMovement("tenant-1", {
      ingredientId: "ing-1",
      type: "in",
      quantity: "3",
    });
    const setArgs = db.update.mock.results[0].value.set.mock.calls[0][0];
    expect(setArgs.stock).toBe("13");
  });

  it("subtracts quantity from stock on 'out' movement", async () => {
    const db = buildDb({ stock: "10" });
    const service = new InventoryService(db as never);
    await service.registerMovement("tenant-1", {
      ingredientId: "ing-1",
      type: "out",
      quantity: "4",
    });
    const setArgs = db.update.mock.results[0].value.set.mock.calls[0][0];
    expect(setArgs.stock).toBe("6");
  });

  it("sets stock additively for adjustment movements", async () => {
    const db = buildDb({ stock: "10" });
    const service = new InventoryService(db as never);
    await service.registerMovement("tenant-1", {
      ingredientId: "ing-1",
      type: "adjustment",
      quantity: "-2",
    });
    const setArgs = db.update.mock.results[0].value.set.mock.calls[0][0];
    expect(setArgs.stock).toBe("8");
  });
});

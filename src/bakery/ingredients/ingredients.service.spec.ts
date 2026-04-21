import { NotFoundException } from "@nestjs/common";
import { IngredientsService } from "./ingredients.service";

interface FakeIngredient {
  id: string;
  tenantId: string;
  name: string;
  unit: string;
  stock: string;
  minStock: string;
  costPerUnit: string;
  updatedAt: Date | null;
}

function buildDb(rows: FakeIngredient[]) {
  const returning = jest.fn();
  const where = jest.fn();
  const set = jest.fn().mockReturnValue({ where });
  where.mockReturnValue({ returning });
  return {
    query: {
      ingredients: {
        findMany: jest
          .fn()
          .mockImplementation(({ where: _w }: { where: unknown }) =>
            Promise.resolve(rows),
          ),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(rows[0])),
      },
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([rows[0]]),
      }),
    }),
    update: jest.fn().mockReturnValue({ set }),
    delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
    _mocks: { returning, where, set },
  };
}

describe("IngredientsService", () => {
  const baseRow: FakeIngredient = {
    id: "ing-1",
    tenantId: "tenant-1",
    name: "Flour",
    unit: "kg",
    stock: "5",
    minStock: "2",
    costPerUnit: "3.50",
    updatedAt: null,
  };

  it("returns all ingredients scoped to tenant", async () => {
    const db = buildDb([baseRow]);
    const service = new IngredientsService(db as never);
    const result = await service.findAll("tenant-1");
    expect(result).toEqual([baseRow]);
    expect(db.query.ingredients.findMany).toHaveBeenCalled();
  });

  it("throws NotFoundException when ingredient is missing", async () => {
    const db = buildDb([]);
    const service = new IngredientsService(db as never);
    db.query.ingredients.findFirst.mockResolvedValueOnce(undefined);
    await expect(service.findById("tenant-1", "missing-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("returns only ingredients with stock <= minStock as low stock", async () => {
    const db = buildDb([
      baseRow,
      { ...baseRow, id: "ing-2", name: "Sugar", stock: "1", minStock: "2" },
      { ...baseRow, id: "ing-3", name: "Butter", stock: "0.5", minStock: "1" },
    ]);
    const service = new IngredientsService(db as never);
    const low = await service.findLowStock("tenant-1");
    expect(low.map((r) => r.id)).toEqual(["ing-2", "ing-3"]);
  });

  it("creates an ingredient with injected tenantId", async () => {
    const db = buildDb([baseRow]);
    const service = new IngredientsService(db as never);
    const result = await service.create("tenant-1", {
      name: "Flour",
      unit: "kg",
    });
    expect(result).toEqual(baseRow);
    expect(db.insert).toHaveBeenCalled();
  });
});

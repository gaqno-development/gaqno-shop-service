import { ProductService } from "./product.service";
import { EventsService } from "../events/events.service";
import { LOW_STOCK_THRESHOLD } from "../events/constants";

interface EmitCall {
  readonly tenantId: string;
  readonly payload: { productId: string; name: string; quantity: number };
}

function createRecordingEvents(): {
  readonly events: EventsService;
  readonly calls: EmitCall[];
} {
  const calls: EmitCall[] = [];
  const events = new EventsService();
  events.emitInventoryLowStock = (tenantId, payload) => {
    calls.push({ tenantId, payload });
  };
  return { events, calls };
}

interface ProductRow {
  id: string;
  name: string;
  tenantId: string;
  inventoryQuantity: number | null;
  price: string;
}

function createFakeDb(before: ProductRow, after: ProductRow) {
  return {
    query: {
      products: {
        findFirst: async () => before,
      },
    },
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [after],
        }),
      }),
    }),
  } as unknown as ConstructorParameters<typeof ProductService>[0];
}

describe("ProductService inventory low-stock", () => {
  const baseRow = (quantity: number): ProductRow => ({
    id: "prod-1",
    name: "Brigadeiro",
    tenantId: "tenant-1",
    inventoryQuantity: quantity,
    price: "10.00",
  });

  it("should emit inventory:low-stock when quantity crosses the threshold going down", async () => {
    const { events, calls } = createRecordingEvents();
    const before = baseRow(LOW_STOCK_THRESHOLD + 5);
    const after = baseRow(LOW_STOCK_THRESHOLD - 1);
    const svc = new ProductService(createFakeDb(before, after), events);

    await svc.update("tenant-1", "prod-1", {
      inventoryQuantity: after.inventoryQuantity ?? 0,
    });

    expect(calls).toEqual([
      {
        tenantId: "tenant-1",
        payload: {
          productId: "prod-1",
          name: "Brigadeiro",
          quantity: after.inventoryQuantity,
        },
      },
    ]);
  });

  it("should not emit when quantity stays above threshold", async () => {
    const { events, calls } = createRecordingEvents();
    const before = baseRow(LOW_STOCK_THRESHOLD + 10);
    const after = baseRow(LOW_STOCK_THRESHOLD + 6);
    const svc = new ProductService(createFakeDb(before, after), events);

    await svc.update("tenant-1", "prod-1", {
      inventoryQuantity: after.inventoryQuantity ?? 0,
    });

    expect(calls).toEqual([]);
  });

  it("should not emit when already below threshold (no re-crossing)", async () => {
    const { events, calls } = createRecordingEvents();
    const before = baseRow(2);
    const after = baseRow(1);
    const svc = new ProductService(createFakeDb(before, after), events);

    await svc.update("tenant-1", "prod-1", {
      inventoryQuantity: after.inventoryQuantity ?? 0,
    });

    expect(calls).toEqual([]);
  });

  it("should not emit when quantity increases above threshold", async () => {
    const { events, calls } = createRecordingEvents();
    const before = baseRow(2);
    const after = baseRow(LOW_STOCK_THRESHOLD + 10);
    const svc = new ProductService(createFakeDb(before, after), events);

    await svc.update("tenant-1", "prod-1", {
      inventoryQuantity: after.inventoryQuantity ?? 0,
    });

    expect(calls).toEqual([]);
  });
});

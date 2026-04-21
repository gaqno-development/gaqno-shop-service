import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  ingredients,
  inventoryMovements,
  InventoryMovement,
  NewInventoryMovement,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import { CreateInventoryMovementDto } from "./dto/inventory.dto";

@Injectable()
export class InventoryService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async listMovements(
    tenantId: string,
    ingredientId?: string,
  ): Promise<InventoryMovement[]> {
    return this.db.query.inventoryMovements.findMany({
      where: ingredientId
        ? and(
            eq(inventoryMovements.tenantId, tenantId),
            eq(inventoryMovements.ingredientId, ingredientId),
          )
        : eq(inventoryMovements.tenantId, tenantId),
      orderBy: [desc(inventoryMovements.createdAt)],
    });
  }

  async registerMovement(
    tenantId: string,
    dto: CreateInventoryMovementDto,
  ): Promise<InventoryMovement> {
    const ingredient = await this.db.query.ingredients.findFirst({
      where: and(
        eq(ingredients.tenantId, tenantId),
        eq(ingredients.id, dto.ingredientId),
      ),
    });
    if (!ingredient) {
      throw new NotFoundException(
        `Ingredient "${dto.ingredientId}" not found for tenant`,
      );
    }

    const payload: NewInventoryMovement = {
      tenantId,
      ingredientId: dto.ingredientId,
      type: dto.type,
      quantity: dto.quantity,
      reason: dto.reason,
      orderId: dto.orderId,
    };

    const [movement] = await this.db
      .insert(inventoryMovements)
      .values(payload)
      .returning();

    const delta = this.computeDelta(dto.type, dto.quantity);
    const nextStock = Number(ingredient.stock ?? 0) + delta;
    await this.db
      .update(ingredients)
      .set({ stock: String(nextStock), updatedAt: new Date() })
      .where(
        and(
          eq(ingredients.tenantId, tenantId),
          eq(ingredients.id, dto.ingredientId),
        ),
      );

    return movement;
  }

  private computeDelta(type: string, quantity: string): number {
    const q = Number.parseFloat(quantity);
    if (!Number.isFinite(q)) {
      return 0;
    }
    if (type === "in") {
      return q;
    }
    if (type === "out") {
      return -q;
    }
    return q;
  }
}

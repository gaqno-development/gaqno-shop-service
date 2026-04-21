import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import {
  ingredients,
  Ingredient,
  NewIngredient,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import {
  CreateIngredientDto,
  UpdateIngredientDto,
} from "./dto/ingredients.dto";

@Injectable()
export class IngredientsService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(tenantId: string): Promise<Ingredient[]> {
    return this.db.query.ingredients.findMany({
      where: eq(ingredients.tenantId, tenantId),
      orderBy: [asc(ingredients.name)],
    });
  }

  async findById(tenantId: string, id: string): Promise<Ingredient> {
    const row = await this.db.query.ingredients.findFirst({
      where: and(eq(ingredients.tenantId, tenantId), eq(ingredients.id, id)),
    });
    if (!row) {
      throw new NotFoundException(`Ingredient with id "${id}" not found`);
    }
    return row;
  }

  async findLowStock(tenantId: string): Promise<Ingredient[]> {
    const all = await this.findAll(tenantId);
    return all.filter(
      (ing) => Number(ing.stock ?? 0) <= Number(ing.minStock ?? 0),
    );
  }

  async create(
    tenantId: string,
    dto: CreateIngredientDto,
  ): Promise<Ingredient> {
    const payload: NewIngredient = { tenantId, ...dto };
    const [row] = await this.db
      .insert(ingredients)
      .values(payload)
      .returning();
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateIngredientDto,
  ): Promise<Ingredient> {
    await this.findById(tenantId, id);
    const [row] = await this.db
      .update(ingredients)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(ingredients.tenantId, tenantId), eq(ingredients.id, id)))
      .returning();
    return row;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.db
      .delete(ingredients)
      .where(and(eq(ingredients.tenantId, tenantId), eq(ingredients.id, id)));
  }
}

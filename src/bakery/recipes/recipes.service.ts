import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  recipes,
  recipeIngredients,
  ingredients as ingredientsTable,
  Recipe,
  NewRecipe,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import {
  CreateRecipeDto,
  UpdateRecipeDto,
  ReplaceRecipeIngredientsDto,
} from "./dto/recipes.dto";
import {
  computeCost,
  type CostBreakdown,
} from "../../shared/cost-calculation";

@Injectable()
export class RecipesService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(tenantId: string): Promise<Recipe[]> {
    return this.db.query.recipes.findMany({
      where: eq(recipes.tenantId, tenantId),
      orderBy: [asc(recipes.name)],
    });
  }

  async findById(tenantId: string, id: string): Promise<Recipe> {
    const row = await this.db.query.recipes.findFirst({
      where: and(eq(recipes.tenantId, tenantId), eq(recipes.id, id)),
    });
    if (!row) {
      throw new NotFoundException(`Recipe with id "${id}" not found`);
    }
    return row;
  }

  async create(tenantId: string, dto: CreateRecipeDto): Promise<Recipe> {
    const { ingredients: ingList, ...rest } = dto;
    const payload: NewRecipe = { tenantId, ...rest };
    const [row] = await this.db
      .insert(recipes)
      .values(payload)
      .returning();
    if (ingList && ingList.length > 0) {
      await this.replaceIngredients(tenantId, row.id, { ingredients: ingList });
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateRecipeDto,
  ): Promise<Recipe> {
    await this.findById(tenantId, id);
    const { ingredients: ingList, ...rest } = dto;
    const [row] = await this.db
      .update(recipes)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(recipes.tenantId, tenantId), eq(recipes.id, id)))
      .returning();
    if (ingList) {
      await this.replaceIngredients(tenantId, id, { ingredients: ingList });
    }
    return row;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.db
      .delete(recipes)
      .where(and(eq(recipes.tenantId, tenantId), eq(recipes.id, id)));
  }

  async getIngredients(tenantId: string, recipeId: string) {
    return this.db.query.recipeIngredients.findMany({
      where: and(
        eq(recipeIngredients.tenantId, tenantId),
        eq(recipeIngredients.recipeId, recipeId),
      ),
    });
  }

  async replaceIngredients(
    tenantId: string,
    recipeId: string,
    dto: ReplaceRecipeIngredientsDto,
  ): Promise<void> {
    await this.findById(tenantId, recipeId);
    await this.db
      .delete(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.tenantId, tenantId),
          eq(recipeIngredients.recipeId, recipeId),
        ),
      );
    if (dto.ingredients.length === 0) {
      return;
    }
    await this.db.insert(recipeIngredients).values(
      dto.ingredients.map((i) => ({
        tenantId,
        recipeId,
        ingredientId: i.ingredientId,
        quantity: i.quantity,
      })),
    );
  }

  async getCost(
    tenantId: string,
    recipeId: string,
  ): Promise<CostBreakdown> {
    const recipe = await this.findById(tenantId, recipeId);
    const links = await this.getIngredients(tenantId, recipeId);
    if (links.length === 0) {
      return computeCost({
        laborCost: recipe.laborCost,
        overheadCost: recipe.overheadCost,
        profitMarginPercent: recipe.profitMarginPercent,
        yieldQuantity: recipe.yieldQuantity,
        materials: [],
      });
    }
    const ingredientRows = await this.db.query.ingredients.findMany({
      where: and(
        eq(ingredientsTable.tenantId, tenantId),
        inArray(
          ingredientsTable.id,
          links.map((l) => l.ingredientId),
        ),
      ),
    });
    const costLookup = new Map(
      ingredientRows.map((i) => [i.id, i.costPerUnit]),
    );
    return computeCost({
      laborCost: recipe.laborCost,
      overheadCost: recipe.overheadCost,
      profitMarginPercent: recipe.profitMarginPercent,
      yieldQuantity: recipe.yieldQuantity,
      materials: links.map((l) => ({
        quantity: l.quantity,
        costPerUnit: costLookup.get(l.ingredientId) ?? "0",
      })),
    });
  }
}

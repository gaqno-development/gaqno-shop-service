import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  products,
  recipes,
  recipeIngredients,
  productIngredients,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import { TenantService } from "../../tenant/tenant.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  BakeryOrderStatus,
  canTransition,
  isDecorationReviewTransition,
  shouldDeductIngredients,
} from "./status-transitions";
import {
  LeadDayProduct,
  validateLeadDays,
} from "./validate-lead-days";
import {
  ProductDirectIngredient,
  ProductRecipeDeduction,
  mergeDeductionPlans,
  planDirectDeduction,
  planRecipeDeduction,
} from "./plan-ingredient-deduction";

export interface OrderItemForLifecycle {
  readonly productId: string;
  readonly quantity: number;
}

export interface LeadDayValidationRequest {
  readonly tenantId: string;
  readonly deliveryDate: Date;
  readonly items: readonly OrderItemForLifecycle[];
  readonly fallbackLeadDays?: number;
}

export interface StatusChangeContext {
  readonly tenantId: string;
  readonly orderId: string;
  readonly previous: BakeryOrderStatus;
  readonly next: BakeryOrderStatus;
  readonly items: readonly OrderItemForLifecycle[];
}

const DEFAULT_FALLBACK_LEAD_DAYS = 3;

@Injectable()
export class BakeryOrderLifecycleService {
  private readonly logger = new Logger(BakeryOrderLifecycleService.name);

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly tenants: TenantService,
    private readonly inventory: InventoryService,
  ) {}

  async isBakeryEnabled(tenantId: string): Promise<boolean> {
    const flags = await this.tenants.getFeatureFlags(tenantId);
    return Boolean(flags?.featureBakery);
  }

  assertTransition(previous: BakeryOrderStatus, next: BakeryOrderStatus): void {
    if (!canTransition(previous, next)) {
      throw new BadRequestException(
        `Invalid status transition: ${previous} → ${next}`,
      );
    }
  }

  async validateLeadDaysForOrder(
    request: LeadDayValidationRequest,
  ): Promise<void> {
    const enabled = await this.isBakeryEnabled(request.tenantId);
    if (!enabled) return;
    if (request.items.length === 0) return;

    const productIds = Array.from(
      new Set(request.items.map((i) => i.productId)),
    );
    const loaded = await this.db.query.products.findMany({
      where: and(
        eq(products.tenantId, request.tenantId),
        inArray(products.id, productIds),
      ),
      columns: { id: true, leadDays: true },
    });
    const products_: readonly LeadDayProduct[] = loaded.map((p) => ({
      id: p.id,
      leadDays: p.leadDays ?? null,
    }));
    const result = validateLeadDays({
      now: new Date(),
      deliveryDate: request.deliveryDate,
      products: products_,
      fallbackLeadDays: request.fallbackLeadDays ?? DEFAULT_FALLBACK_LEAD_DAYS,
    });
    if (!result.valid) {
      throw new BadRequestException({
        message: `Delivery date must be at least ${result.requiredLeadDays} business days out`,
        requiredLeadDays: result.requiredLeadDays,
        earliestDeliveryDate: result.earliestDeliveryDate.toISOString(),
        violatingProductIds: result.violatingProductIds,
      });
    }
  }

  async handleStatusChange(context: StatusChangeContext): Promise<void> {
    const enabled = await this.isBakeryEnabled(context.tenantId);
    if (!enabled) return;
    if (!shouldDeductIngredients(context.previous, context.next)) return;
    await this.deductIngredientsForOrder(
      context.tenantId,
      context.orderId,
      context.items,
    );
  }

  describeDecorationReview(next: BakeryOrderStatus): boolean {
    return isDecorationReviewTransition(next);
  }

  private async deductIngredientsForOrder(
    tenantId: string,
    orderId: string,
    items: readonly OrderItemForLifecycle[],
  ): Promise<void> {
    if (items.length === 0) return;
    const productIds = Array.from(new Set(items.map((i) => i.productId)));

    const productRows = await this.db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        inArray(products.id, productIds),
      ),
      columns: { id: true, recipeId: true },
    });
    const recipeIds = productRows
      .map((p) => p.recipeId)
      .filter((id): id is string => Boolean(id));

    const recipeDeduction = await this.buildRecipePlan(
      tenantId,
      items,
      productRows,
      recipeIds,
    );
    const directDeduction = await this.buildDirectPlan(tenantId, items);
    const merged = mergeDeductionPlans(recipeDeduction, directDeduction);

    for (const entry of merged) {
      if (entry.quantity <= 0) continue;
      try {
        await this.inventory.registerMovement(tenantId, {
          ingredientId: entry.ingredientId,
          type: "out",
          quantity: entry.quantity.toString(),
          reason: `Order ${orderId}`,
          orderId,
        });
      } catch (err) {
        this.logger.error(
          `Failed to deduct ingredient ${entry.ingredientId} for order ${orderId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async buildRecipePlan(
    tenantId: string,
    items: readonly OrderItemForLifecycle[],
    productRows: readonly { id: string; recipeId: string | null }[],
    recipeIds: readonly string[],
  ): Promise<readonly ReturnType<typeof planRecipeDeduction>[number][]> {
    if (recipeIds.length === 0) return [];
    const recipeRows = await this.db.query.recipes.findMany({
      where: and(
        eq(recipes.tenantId, tenantId),
        inArray(recipes.id, recipeIds as string[]),
      ),
      columns: { id: true, yieldQuantity: true },
    });
    const recipeIngRows = await this.db.query.recipeIngredients.findMany({
      where: and(
        eq(recipeIngredients.tenantId, tenantId),
        inArray(recipeIngredients.recipeId, recipeIds as string[]),
      ),
      columns: { recipeId: true, ingredientId: true, quantity: true },
    });
    const productToRecipe = new Map(
      productRows
        .filter((p) => p.recipeId)
        .map((p) => [p.id, p.recipeId as string]),
    );
    const recipeYields = new Map(
      recipeRows.map((r) => [r.id, Number(r.yieldQuantity ?? 0)]),
    );
    const ingredientsByRecipe = new Map<
      string,
      { ingredientId: string; quantityPerRecipeYield: number }[]
    >();
    for (const row of recipeIngRows) {
      const list = ingredientsByRecipe.get(row.recipeId) ?? [];
      list.push({
        ingredientId: row.ingredientId,
        quantityPerRecipeYield: Number(row.quantity),
      });
      ingredientsByRecipe.set(row.recipeId, list);
    }
    const planInput: ProductRecipeDeduction[] = [];
    for (const item of items) {
      const recipeId = productToRecipe.get(item.productId);
      if (!recipeId) continue;
      planInput.push({
        productId: item.productId,
        quantity: item.quantity,
        recipeYield: recipeYields.get(recipeId) ?? 0,
        ingredients: ingredientsByRecipe.get(recipeId) ?? [],
      });
    }
    return planRecipeDeduction(planInput);
  }

  private async buildDirectPlan(
    tenantId: string,
    items: readonly OrderItemForLifecycle[],
  ): Promise<readonly ReturnType<typeof planDirectDeduction>[number][]> {
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const rows = await this.db.query.productIngredients.findMany({
      where: and(
        eq(productIngredients.tenantId, tenantId),
        inArray(productIngredients.productId, productIds),
      ),
      columns: { productId: true, ingredientId: true, quantity: true },
    });
    if (rows.length === 0) return [];
    const byProduct = new Map<
      string,
      { ingredientId: string; quantityPerRecipeYield: number }[]
    >();
    for (const row of rows) {
      const list = byProduct.get(row.productId) ?? [];
      list.push({
        ingredientId: row.ingredientId,
        quantityPerRecipeYield: Number(row.quantity),
      });
      byProduct.set(row.productId, list);
    }
    const planInput: ProductDirectIngredient[] = items
      .filter((i) => byProduct.has(i.productId))
      .map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        ingredients: byProduct.get(i.productId) ?? [],
      }));
    return planDirectDeduction(planInput);
  }
}

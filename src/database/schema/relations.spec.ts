import { createTableRelationsHelpers, getTableName, Relation } from "drizzle-orm";
import * as schema from "./index";
import { products, categories, productVariations } from "./catalog";

interface RelationsTableLike {
  readonly table: { _: { name: string } };
  readonly config: (...args: unknown[]) => Record<string, Relation>;
}

function resolveConfig(entry: RelationsTableLike): Record<string, Relation> {
  const helpers = createTableRelationsHelpers(entry.table as never);
  return entry.config(helpers);
}

describe("schema relations", () => {
  it("should expose productsRelations registered on products table", () => {
    const productsRelations = (schema as unknown as Record<string, unknown>)
      .productsRelations as RelationsTableLike | undefined;
    expect(productsRelations).toBeDefined();
    expect(productsRelations?.table).toBe(products);
  });

  it("should expose categoriesRelations registered on categories table", () => {
    const categoriesRelations = (schema as unknown as Record<string, unknown>)
      .categoriesRelations as RelationsTableLike | undefined;
    expect(categoriesRelations).toBeDefined();
    expect(categoriesRelations?.table).toBe(categories);
  });

  it("should declare products.category relation pointing to categories table", () => {
    const productsRelations = (schema as unknown as Record<string, unknown>)
      .productsRelations as RelationsTableLike;
    const config = resolveConfig(productsRelations);
    expect(config.category).toBeDefined();
    expect(config.category.referencedTableName).toBe(getTableName(categories));
  });

  it("should declare products.variations relation pointing to product_variations", () => {
    const productsRelations = (schema as unknown as Record<string, unknown>)
      .productsRelations as RelationsTableLike;
    const config = resolveConfig(productsRelations);
    expect(config.variations).toBeDefined();
    expect(config.variations.referencedTableName).toBe(
      getTableName(productVariations),
    );
  });

  it("should declare categories.products relation pointing to products", () => {
    const categoriesRelations = (schema as unknown as Record<string, unknown>)
      .categoriesRelations as RelationsTableLike;
    const config = resolveConfig(categoriesRelations);
    expect(config.products).toBeDefined();
    expect(config.products.referencedTableName).toBe(getTableName(products));
  });
});

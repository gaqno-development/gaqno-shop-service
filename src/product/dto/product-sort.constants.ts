export const PRODUCT_SORT_VALUES = [
  "name",
  "price_asc",
  "price_desc",
  "newest",
  "oldest",
] as const;

export type ProductSortValue = (typeof PRODUCT_SORT_VALUES)[number];

export interface ProductSortResolved {
  readonly sortBy: "createdAt" | "name" | "price" | "updatedAt";
  readonly sortOrder: "asc" | "desc";
}

export const PRODUCT_SORT_MAP: Record<ProductSortValue, ProductSortResolved> = {
  name: { sortBy: "name", sortOrder: "asc" },
  price_asc: { sortBy: "price", sortOrder: "asc" },
  price_desc: { sortBy: "price", sortOrder: "desc" },
  newest: { sortBy: "createdAt", sortOrder: "desc" },
  oldest: { sortBy: "createdAt", sortOrder: "asc" },
};

export interface WishlistItemDetail {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  productPrice: number;
  productSlug: string;
  note: string | null;
  sortOrder: number;
  addedAt: Date;
}

export interface WishlistWithItems {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  isPublic: boolean;
  shareToken: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  items: WishlistItemDetail[];
}

type ProductImage = { readonly url: string };

export function isProductImageArray(
  value: unknown,
): value is readonly ProductImage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { url?: unknown }).url === "string",
    )
  );
}

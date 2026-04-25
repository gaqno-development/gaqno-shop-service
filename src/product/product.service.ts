import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, like, desc, asc, SQL, sql, gte, lte } from "drizzle-orm";
import { categories, products, Product, NewProduct } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { EventsService } from "../events/events.service";
import { LOW_STOCK_THRESHOLD } from "../events/constants";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from "./dto/product.dto";
import {
  PRODUCT_SORT_MAP,
  type ProductSortValue,
} from "./dto/product-sort.constants";

const PRODUCT_SORT_COLUMNS = {
  createdAt: products.createdAt,
  name: products.name,
  price: products.price,
  updatedAt: products.updatedAt,
} as const;

type ProductSortColumn = keyof typeof PRODUCT_SORT_COLUMNS;

function resolveSort(query: ProductQueryDto): {
  column: (typeof PRODUCT_SORT_COLUMNS)[ProductSortColumn];
  order: "asc" | "desc";
} {
  if (query.sort && query.sort in PRODUCT_SORT_MAP) {
    const mapped = PRODUCT_SORT_MAP[query.sort as ProductSortValue];
    return { column: PRODUCT_SORT_COLUMNS[mapped.sortBy], order: mapped.sortOrder };
  }
  const sortBy = (query.sortBy as ProductSortColumn) ?? "createdAt";
  const column = PRODUCT_SORT_COLUMNS[sortBy] ?? PRODUCT_SORT_COLUMNS.createdAt;
  const order = query.sortOrder === "asc" ? "asc" : "desc";
  return { column, order };
}

@Injectable()
export class ProductService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly events: EventsService,
  ) {}

  async findAll(tenantId: string, query: ProductQueryDto) {
    const {
      categoryId,
      category,
      isActive = true,
      isFeatured,
      limit = 20,
      page,
      search,
      minPrice,
      maxPrice,
    } = query;
    const offset = query.offset ?? (page ? (page - 1) * limit : 0);

    const conditions: SQL[] = [eq(products.tenantId, tenantId)];

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

    if (isFeatured !== undefined) {
      conditions.push(eq(products.isFeatured, isFeatured));
    }

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    } else if (category) {
      const resolved = await this.db.query.categories.findFirst({
        where: and(
          eq(categories.tenantId, tenantId),
          eq(categories.slug, category),
        ),
        columns: { id: true },
      });
      if (resolved) {
        conditions.push(eq(products.categoryId, resolved.id));
      } else {
        return { items: [], total: 0, limit, offset };
      }
    }

    if (search) {
      conditions.push(like(products.name, `%${search}%`));
    }

    if (minPrice !== undefined) {
      conditions.push(gte(products.price, String(minPrice)));
    }
    if (maxPrice !== undefined) {
      conditions.push(lte(products.price, String(maxPrice)));
    }

    const { column, order } = resolveSort(query);
    const orderBy = order === "asc" ? asc(column) : desc(column);

    const items = await this.db.query.products.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy,
      with: {
        category: true,
      },
    });

    const total = await this.db
      .select({ count: sql`count(*)::int` })
      .from(products)
      .where(and(...conditions));

    const totalCount = Number(total[0]?.count ?? 0);
    const currentPage = page ?? Math.floor(offset / limit) + 1;
    return {
      data: items,
      items,
      total: totalCount,
      page: currentPage,
      limit,
      offset,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    };
  }

  async findOne(tenantId: string, slug: string): Promise<Product> {
    const product = await this.db.query.products.findFirst({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.slug, slug),
        eq(products.isActive, true),
      ),
      with: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    return product;
  }

  async findById(tenantId: string, id: string): Promise<Product> {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.tenantId, tenantId), eq(products.id, id)),
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
  }

  async create(tenantId: string, dto: CreateProductDto): Promise<Product> {
    const newProduct: NewProduct = {
      tenantId,
      ...dto,
      price: dto.price.toString(),
      compareAtPrice: dto.compareAtPrice?.toString(),
    };

    const [product] = await this.db.insert(products).values(newProduct).returning();
    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    const before = await this.findById(tenantId, id);

    const { price, ...rest } = dto;
    const payload: Partial<NewProduct> & { updatedAt: Date } = {
      ...rest,
      updatedAt: new Date(),
    };
    if (price !== undefined) payload.price = price.toString();

    const [product] = await this.db
      .update(products)
      .set(payload)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();

    this.maybeEmitLowStock(tenantId, before, product);
    return product;
  }

  private maybeEmitLowStock(
    tenantId: string,
    before: Product,
    after: Product,
  ): void {
    const prev = before.inventoryQuantity ?? 0;
    const next = after.inventoryQuantity ?? 0;
    const crossedDown = prev > LOW_STOCK_THRESHOLD && next <= LOW_STOCK_THRESHOLD;
    if (crossedDown) {
      this.events.emitInventoryLowStock(tenantId, {
        productId: after.id,
        name: after.name,
        quantity: next,
      });
    }
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);

    await this.db
      .delete(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)));
  }

  async getFeatured(tenantId: string, limit: number = 8) {
    return this.db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.isFeatured, true)
      ),
      limit,
      orderBy: desc(products.createdAt),
    });
  }
}

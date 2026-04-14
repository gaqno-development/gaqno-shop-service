import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, like, desc, asc, SQL } from "drizzle-orm";
import { products, categories, Product, NewProduct } from "../database/schema";
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from "./dto/product.dto";

@Injectable()
export class ProductService {
  constructor(@Inject("DATABASE") private db: any) {}

  async findAll(tenantId: string, query: ProductQueryDto) {
    const {
      categoryId,
      isActive = true,
      isFeatured,
      limit = 20,
      offset = 0,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const conditions: SQL[] = [eq(products.tenantId, tenantId)];

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

    if (isFeatured !== undefined) {
      conditions.push(eq(products.isFeatured, isFeatured));
    }

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (search) {
      conditions.push(like(products.name, `%${search}%`));
    }

    const orderBy = sortOrder === "asc" 
      ? asc(products[sortBy as keyof typeof products]) 
      : desc(products[sortBy as keyof typeof products]);

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

    return {
      items,
      total: total[0]?.count || 0,
      limit,
      offset,
    };
  }

  async findOne(tenantId: string, slug: string): Promise<Product> {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.tenantId, tenantId), eq(products.slug, slug)),
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
    };

    const [product] = await this.db.insert(products).values(newProduct).returning();
    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findById(tenantId, id);

    const [product] = await this.db
      .update(products)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();

    return product;
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

// Helper for sql count
import { sql } from "drizzle-orm";

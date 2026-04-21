import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { categories, Category, NewCategory } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

@Injectable()
export class CategoryService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(tenantId: string): Promise<Category[]> {
    return this.db.query.categories.findMany({
      where: and(
        eq(categories.tenantId, tenantId),
        eq(categories.isActive, true),
      ),
      orderBy: [asc(categories.sortOrder), asc(categories.name)],
    });
  }

  async findOne(tenantId: string, slug: string): Promise<Category> {
    const category = await this.db.query.categories.findFirst({
      where: and(
        eq(categories.tenantId, tenantId),
        eq(categories.slug, slug),
      ),
    });

    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }

    return category;
  }

  async findById(tenantId: string, id: string): Promise<Category> {
    const category = await this.db.query.categories.findFirst({
      where: and(eq(categories.tenantId, tenantId), eq(categories.id, id)),
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" not found`);
    }

    return category;
  }

  async create(tenantId: string, dto: CreateCategoryDto): Promise<Category> {
    const payload: NewCategory = { tenantId, ...dto };
    const [category] = await this.db
      .insert(categories)
      .values(payload)
      .returning();
    return category;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    await this.findById(tenantId, id);
    const [category] = await this.db
      .update(categories)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
      .returning();
    return category;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.db
      .delete(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)));
  }
}

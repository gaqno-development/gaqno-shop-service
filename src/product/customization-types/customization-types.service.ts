import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import {
  customizationTypes,
  CustomizationType,
  NewCustomizationType,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import {
  CreateCustomizationTypeDto,
  UpdateCustomizationTypeDto,
} from "./dto/customization-types.dto";

@Injectable()
export class CustomizationTypesService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(tenantId: string): Promise<CustomizationType[]> {
    return this.db.query.customizationTypes.findMany({
      where: and(
        eq(customizationTypes.tenantId, tenantId),
        eq(customizationTypes.isActive, true),
      ),
      orderBy: [asc(customizationTypes.sortOrder), asc(customizationTypes.name)],
    });
  }

  async findAllWithInactive(tenantId: string): Promise<CustomizationType[]> {
    return this.db.query.customizationTypes.findMany({
      where: eq(customizationTypes.tenantId, tenantId),
      orderBy: [asc(customizationTypes.sortOrder), asc(customizationTypes.name)],
    });
  }

  async findById(tenantId: string, id: string): Promise<CustomizationType> {
    const row = await this.db.query.customizationTypes.findFirst({
      where: and(
        eq(customizationTypes.tenantId, tenantId),
        eq(customizationTypes.id, id),
      ),
    });
    if (!row) {
      throw new NotFoundException(`Customization type with id "${id}" not found`);
    }
    return row;
  }

  async create(
    tenantId: string,
    dto: CreateCustomizationTypeDto,
  ): Promise<CustomizationType> {
    const slug =
      dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const existing = await this.db.query.customizationTypes.findFirst({
      where: and(
        eq(customizationTypes.tenantId, tenantId),
        eq(customizationTypes.slug, slug),
      ),
    });
    if (existing) {
      throw new Error(`Customization type with slug "${slug}" already exists`);
    }

    const payload: NewCustomizationType = {
      tenantId,
      name: dto.name,
      slug,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    };
    const [row] = await this.db
      .insert(customizationTypes)
      .values(payload)
      .returning();
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCustomizationTypeDto,
  ): Promise<CustomizationType> {
    await this.findById(tenantId, id);
    const [row] = await this.db
      .update(customizationTypes)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(customizationTypes.tenantId, tenantId), eq(customizationTypes.id, id)))
      .returning();
    return row;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.db
      .delete(customizationTypes)
      .where(and(eq(customizationTypes.tenantId, tenantId), eq(customizationTypes.id, id)));
  }
}
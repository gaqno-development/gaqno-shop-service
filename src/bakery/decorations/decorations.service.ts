import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import {
  decorations,
  Decoration,
  NewDecoration,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import {
  CreateDecorationDto,
  UpdateDecorationDto,
} from "./dto/decorations.dto";

@Injectable()
export class DecorationsService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(
    tenantId: string,
    onlyActive = false,
  ): Promise<Decoration[]> {
    return this.db.query.decorations.findMany({
      where: onlyActive
        ? and(
            eq(decorations.tenantId, tenantId),
            eq(decorations.isActive, true),
          )
        : eq(decorations.tenantId, tenantId),
      orderBy: [asc(decorations.name)],
    });
  }

  async findById(tenantId: string, id: string): Promise<Decoration> {
    const row = await this.db.query.decorations.findFirst({
      where: and(eq(decorations.tenantId, tenantId), eq(decorations.id, id)),
    });
    if (!row) {
      throw new NotFoundException(`Decoration with id "${id}" not found`);
    }
    return row;
  }

  async create(
    tenantId: string,
    dto: CreateDecorationDto,
  ): Promise<Decoration> {
    const payload: NewDecoration = { tenantId, ...dto };
    const [row] = await this.db
      .insert(decorations)
      .values(payload)
      .returning();
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateDecorationDto,
  ): Promise<Decoration> {
    await this.findById(tenantId, id);
    const [row] = await this.db
      .update(decorations)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(decorations.tenantId, tenantId), eq(decorations.id, id)))
      .returning();
    return row;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.db
      .delete(decorations)
      .where(and(eq(decorations.tenantId, tenantId), eq(decorations.id, id)));
  }
}

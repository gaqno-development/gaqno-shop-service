import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Subject } from "rxjs";
import {
  adminEvents,
  AdminEvent,
  NewAdminEvent,
} from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import {
  CreateStorefrontEventDto,
  UpdateStorefrontEventDto,
} from "./dto/storefront-events.dto";

export interface StorefrontEventNotification {
  readonly tenantId: string;
  readonly event: "created" | "updated" | "deleted";
  readonly payload: AdminEvent | { id: string };
}

@Injectable()
export class StorefrontEventsService implements OnModuleDestroy {
  private readonly stream$ = new Subject<StorefrontEventNotification>();

  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  onModuleDestroy(): void {
    this.stream$.complete();
  }

  observe() {
    return this.stream$.asObservable();
  }

  async findRange(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<AdminEvent[]> {
    const conditions = [eq(adminEvents.tenantId, tenantId)];
    if (from) {
      conditions.push(gte(adminEvents.date, new Date(from)));
    }
    if (to) {
      conditions.push(lte(adminEvents.date, new Date(to)));
    }
    return this.db.query.adminEvents.findMany({
      where: and(...conditions),
      orderBy: [asc(adminEvents.date)],
    });
  }

  async findById(tenantId: string, id: string): Promise<AdminEvent> {
    const row = await this.db.query.adminEvents.findFirst({
      where: and(eq(adminEvents.tenantId, tenantId), eq(adminEvents.id, id)),
    });
    if (!row) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }
    return row;
  }

  async create(
    tenantId: string,
    dto: CreateStorefrontEventDto,
  ): Promise<AdminEvent> {
    const payload: NewAdminEvent = {
      tenantId,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      date: new Date(dto.date),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      allDay: dto.allDay ?? true,
      color: dto.color,
      completed: dto.completed ?? false,
      orderId: dto.orderId,
    };
    const [row] = await this.db
      .insert(adminEvents)
      .values(payload)
      .returning();
    this.stream$.next({ tenantId, event: "created", payload: row });
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateStorefrontEventDto,
  ): Promise<AdminEvent> {
    await this.findById(tenantId, id);
    const patch: Partial<NewAdminEvent> = {
      ...dto,
      date: dto.date ? new Date(dto.date) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .update(adminEvents)
      .set(patch)
      .where(and(eq(adminEvents.tenantId, tenantId), eq(adminEvents.id, id)))
      .returning();
    this.stream$.next({ tenantId, event: "updated", payload: row });
    return row;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.db
      .delete(adminEvents)
      .where(and(eq(adminEvents.tenantId, tenantId), eq(adminEvents.id, id)));
    this.stream$.next({ tenantId, event: "deleted", payload: { id } });
  }
}

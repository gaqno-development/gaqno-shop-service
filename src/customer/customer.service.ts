import { Injectable, Inject, ConflictException, NotFoundException } from "@nestjs/common";
import { and, desc, eq, like, or } from "drizzle-orm";
import { customers, customerAddresses } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from "./dto/customer.dto";

@Injectable()
export class CustomerService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(tenantId: string, query: CustomerQueryDto) {
    const conditions = [eq(customers.tenantId, tenantId)];

    if (query.email) {
      conditions.push(eq(customers.email, query.email));
    }

    if (query.search) {
      const searchCondition = or(
        like(customers.email, `%${query.search}%`),
        like(customers.firstName, `%${query.search}%`),
        like(customers.lastName, `%${query.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    return this.db.query.customers.findMany({
      where: and(...conditions),
      orderBy: desc(customers.createdAt),
    });
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.db.query.customers.findFirst({
      where: and(eq(customers.tenantId, tenantId), eq(customers.id, id)),
      with: {
        addresses: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  async findByEmail(tenantId: string, email: string) {
    return this.db.query.customers.findFirst({
      where: and(eq(customers.tenantId, tenantId), eq(customers.email, email)),
    });
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    // Check if email already exists
    const existing = await this.findByEmail(tenantId, dto.email);
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const [customer] = await this.db
      .insert(customers)
      .values({
        tenantId,
        ...dto,
      })
      .returning();

    return customer;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(tenantId, id);

    const [customer] = await this.db
      .update(customers)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();

    return customer;
  }

  async getAddresses(tenantId: string, customerId: string) {
    return this.db.query.customerAddresses.findMany({
      where: and(
        eq(customerAddresses.tenantId, tenantId),
        eq(customerAddresses.customerId, customerId)
      ),
    });
  }
}

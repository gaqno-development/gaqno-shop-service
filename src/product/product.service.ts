import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class ProductService {
  constructor(@Inject("DATABASE") private db: any) {}

  async findAll(tenantId: string, options: any = {}) {
    const { categoryId, isActive = true, limit = 20, offset = 0 } = options;
    
    const query = this.db.query.products.findMany({
      where: (products: any, { eq, and }: any) => {
        const conditions = [eq(products.tenantId, tenantId)];
        if (isActive !== undefined) conditions.push(eq(products.isActive, isActive));
        if (categoryId) conditions.push(eq(products.categoryId, categoryId));
        return and(...conditions);
      },
      limit,
      offset,
    });
    
    return query;
  }

  async findOne(tenantId: string, slug: string) {
    return this.db.query.products.findFirst({
      where: (products: any, { eq, and }: any) => 
        and(eq(products.tenantId, tenantId), eq(products.slug, slug)),
    });
  }
}

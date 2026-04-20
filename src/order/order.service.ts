import { Injectable } from "@nestjs/common";
import { OrderReadService } from "./order-read.service";
import { OrderCreateService } from "./order-create.service";
import { OrderStatusService } from "./order-status.service";
import {
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderStatusDto,
} from "./dto/order.dto";

@Injectable()
export class OrderService {
  constructor(
    private readonly reader: OrderReadService,
    private readonly creator: OrderCreateService,
    private readonly statusService: OrderStatusService,
  ) {}

  findAll(tenantId: string, query: OrderQueryDto) {
    return this.reader.findAll(tenantId, query);
  }

  findOne(tenantId: string, orderNumber: string) {
    return this.reader.findOne(tenantId, orderNumber);
  }

  create(tenantId: string, tenantSlug: string, dto: CreateOrderDto) {
    return this.creator.create(tenantId, tenantSlug, dto);
  }

  updateStatus(
    tenantId: string,
    orderNumber: string,
    dto: UpdateOrderStatusDto,
  ) {
    return this.statusService.updateStatus(tenantId, orderNumber, dto);
  }

  getCustomerOrders(
    tenantId: string,
    customerId: string,
    options: { page: number; limit: number; status?: string },
  ) {
    return this.reader.getCustomerOrders(tenantId, customerId, options);
  }

  getCustomerOrderDetail(
    tenantId: string,
    customerId: string,
    orderId: string,
  ) {
    return this.reader.getCustomerOrderDetail(tenantId, customerId, orderId);
  }

  trackOrder(tenantId: string, orderNumber: string, email: string) {
    return this.reader.trackByNumberAndEmail(tenantId, orderNumber, email);
  }
}

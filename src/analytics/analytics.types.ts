export const ANALYTICS_COUNTED_PAYMENT_STATUSES: Array<
  "approved" | "authorized"
> = ["approved", "authorized"];

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  conversionRate: number;
  repeatCustomerRate: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
}

export interface SalesByCategory {
  categoryId: string;
  categoryName: string;
  revenue: number;
  percentage: number;
}

export interface HourlySales {
  hour: number;
  revenue: number;
  orders: number;
}

export interface PaymentMethodStats {
  method: string;
  count: number;
  total: number;
}

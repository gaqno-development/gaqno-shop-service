export const SHOP_SOCKET_PATH = "/shop/socket.io";

export const SHOP_EVENTS = {
  ORDER_CREATED: "order:created",
  ORDER_UPDATED: "order:updated",
  ORDER_STATUS_CHANGED: "order:status-changed",
  INVENTORY_LOW_STOCK: "inventory:low-stock",
  DASHBOARD_STATS_UPDATE: "dashboard:stats-update",
} as const;

export type ShopEventName = (typeof SHOP_EVENTS)[keyof typeof SHOP_EVENTS];

export const LOW_STOCK_THRESHOLD = 5;

export function tenantRoomName(tenantId: string): string {
  return `tenant:${tenantId}`;
}

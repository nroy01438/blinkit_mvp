import "server-only";
import { db } from "@/lib/db";

export type OrderStatus = "PLACED" | "PACKING" | "OUT_FOR_DELIVERY" | "DELIVERED";

interface OrderTiming {
  placedAt: Date;
  packingDurationMs: number;
  deliveryDurationMs: number;
  forcedStatus: string | null;
  isSeedHistory: boolean;
}

const PLACED_PHASE_MS = 1500;

export function computeStatus(order: OrderTiming): OrderStatus {
  if (order.isSeedHistory) return "DELIVERED";
  if (order.forcedStatus === "DELIVERED") return "DELIVERED";
  if (order.forcedStatus === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (order.forcedStatus === "PACKING") return "PACKING";

  const elapsed = Date.now() - order.placedAt.getTime();
  if (elapsed < PLACED_PHASE_MS) return "PLACED";
  if (elapsed < PLACED_PHASE_MS + order.packingDurationMs) return "PACKING";
  if (elapsed < PLACED_PHASE_MS + order.packingDurationMs + order.deliveryDurationMs) return "OUT_FOR_DELIVERY";
  return "DELIVERED";
}

export function remainingSecondsInPhase(order: OrderTiming, status: OrderStatus): number {
  const elapsed = Date.now() - order.placedAt.getTime() - PLACED_PHASE_MS;
  if (status === "PACKING") {
    return Math.max(0, Math.ceil((order.packingDurationMs - elapsed) / 1000));
  }
  if (status === "OUT_FOR_DELIVERY") {
    return Math.max(0, Math.ceil((order.deliveryDurationMs - (elapsed - order.packingDurationMs)) / 1000));
  }
  return 0;
}

export async function ensureDeliveredLogged(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const status = computeStatus(order);
  if (status !== "DELIVERED" || order.deliveredAt || order.isSeedHistory) return;

  await db.order.update({ where: { id: order.id }, data: { deliveredAt: new Date() } });

  const addOn = order.items.find((i) => i.isAddOn);
  if (addOn) {
    await db.suggestionEvent.create({
      data: {
        sessionPersonaId: order.sessionPersonaId,
        orderId: order.id,
        type: "DELIVERED_WITH_ADDON",
        productId: addOn.productId,
        category: order.suggestionAttribute ?? undefined,
        surface: "TRACKING",
      },
    });
  }
}

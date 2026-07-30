"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  getOrCreateSessionPersona,
  resetSessionPersona,
  setCookiePersonaKey,
  type PersonaKey,
} from "@/lib/session";
import { computeStatus } from "@/lib/orderStatus";

export async function switchPersonaAction(key: PersonaKey) {
  await setCookiePersonaKey(key);
  await getOrCreateSessionPersona();
  revalidatePath("/", "layout");
}

export async function resetPersonaAction(key: PersonaKey) {
  await resetSessionPersona(key);
  revalidatePath("/", "layout");
}

export async function fastForwardDayAction() {
  const sp = await getOrCreateSessionPersona();
  await db.sessionPersona.update({ where: { id: sp.id }, data: { simDay: sp.simDay + 1 } });
  revalidatePath("/", "layout");
}

/** Skips the current in-flight order straight to (or past) "Being packed"
 * so the demo doesn't have to wait out the real ~60s timer. */
export async function fastForwardPackingAction() {
  const sp = await getOrCreateSessionPersona();
  const order = await db.order.findFirst({
    where: { sessionPersonaId: sp.id, isSeedHistory: false, deliveredAt: null },
    orderBy: { placedAt: "desc" },
  });
  if (!order) return;
  const status = computeStatus(order);
  const next = status === "PLACED" || status === "PACKING" ? "OUT_FOR_DELIVERY" : "DELIVERED";
  await db.order.update({ where: { id: order.id }, data: { forcedStatus: next } });
  revalidatePath(`/orders/${order.id}`);
  return order.id;
}

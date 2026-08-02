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
  const sp = await getOrCreateSessionPersona();
  // Switching persona is a fresh start, not a continuation — never carry a
  // leftover cart from an earlier visit to this persona into the new one.
  await db.cartItem.deleteMany({ where: { sessionPersonaId: sp.id } });
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

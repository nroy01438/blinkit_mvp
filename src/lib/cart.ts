"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { computeTotals } from "@/lib/pricing";

export async function getCartSummary() {
  const sp = await getOrCreateSessionPersona();
  const items = await db.cartItem.findMany({ where: { sessionPersonaId: sp.id }, include: { product: true } });
  const count = items.reduce((s, i) => s + i.qty, 0);
  const totals = computeTotals(items.map((i) => ({ price: i.product.price, qty: i.qty })));
  return { count, itemTotal: totals.itemTotal, items };
}

export async function getCartQtyMap(): Promise<Record<string, number>> {
  const sp = await getOrCreateSessionPersona();
  const items = await db.cartItem.findMany({ where: { sessionPersonaId: sp.id } });
  const map: Record<string, number> = {};
  for (const i of items) map[i.productId] = i.qty;
  return map;
}

export async function setCartQty(productId: string, qty: number) {
  const sp = await getOrCreateSessionPersona();
  if (qty <= 0) {
    await db.cartItem.deleteMany({ where: { sessionPersonaId: sp.id, productId } });
  } else {
    await db.cartItem.upsert({
      where: { sessionPersonaId_productId: { sessionPersonaId: sp.id, productId } },
      update: { qty },
      create: { sessionPersonaId: sp.id, productId, qty },
    });
  }
  revalidatePath("/", "layout");
  return getCartSummary();
}

export async function clearCart(sessionPersonaId: string) {
  await db.cartItem.deleteMany({ where: { sessionPersonaId } });
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { respondNotNow } from "@/lib/suggestion";
import type { AttributeKey, LeakCategoryKey } from "@/lib/attributes";

async function markCartSuggestionSpent(sessionPersonaId: string) {
  await db.sessionPersona.update({ where: { id: sessionPersonaId }, data: { cartSuggestionSpent: true } });
}

async function addToCartAsAddOn(sessionPersonaId: string, productId: string, attribute: AttributeKey) {
  const existing = await db.cartItem.findUnique({
    where: { sessionPersonaId_productId: { sessionPersonaId, productId } },
  });
  await db.cartItem.upsert({
    where: { sessionPersonaId_productId: { sessionPersonaId, productId } },
    update: { qty: (existing?.qty ?? 0) + 1, isAddOn: true, addOnAttribute: attribute },
    create: { sessionPersonaId, productId, qty: 1, isAddOn: true, addOnAttribute: attribute },
  });
}

/** Cart-stage "Add to this bag" — the household's suggested product is
 * merged straight into the cart, becoming part of whatever order they're
 * about to place, instead of being appended after the fact. */
export async function addSuggestedToCartAction(productId: string, attribute: AttributeKey) {
  const sp = await getOrCreateSessionPersona();
  await addToCartAsAddOn(sp.id, productId, attribute);
  await db.suggestionEvent.create({
    data: { sessionPersonaId: sp.id, type: "TAPPED_ADD", attribute, productId, surface: "CART" },
  });
  await markCartSuggestionSpent(sp.id);
  revalidatePath("/", "layout");
}

export async function declineCartSuggestionAction(leakCategory: LeakCategoryKey) {
  const sp = await getOrCreateSessionPersona();
  await respondNotNow(sp.id, leakCategory);
  await markCartSuggestionSpent(sp.id);
  revalidatePath("/cart");
}

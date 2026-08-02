"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { respondNotNow, respondAskAnswer } from "@/lib/suggestion";
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

export async function answerCartAskAction(attribute: AttributeKey, answeredYes: boolean) {
  const sp = await getOrCreateSessionPersona();
  const product = await respondAskAnswer(sp.id, attribute, answeredYes);
  // A "yes" only reveals the product — it upgrades the graph attribute to
  // ASSERT (see respondAskAnswer) but deliberately doesn't add to cart or
  // spend the per-checkout budget yet, so the card stays live for the
  // customer to actually confirm with "Add to this bag" (or "Not now").
  // A "no" is final: silence the attribute and spend the budget.
  if (!answeredYes) {
    await markCartSuggestionSpent(sp.id);
  }
  revalidatePath("/", "layout");
  return product;
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { computeTotals } from "@/lib/pricing";
import { recomputeGraph } from "@/lib/graph/engine";
import { logRepeatsWithoutSuggestion, leakCategoryOf } from "@/lib/suggestion";
import type { LeakCategoryKey } from "@/lib/attributes";

export async function placeOrder(tip: number): Promise<string> {
  const sp = await getOrCreateSessionPersona();
  const cartItems = await db.cartItem.findMany({
    where: { sessionPersonaId: sp.id },
    include: { product: true },
  });
  if (cartItems.length === 0) throw new Error("Cart is empty");

  const totals = computeTotals(cartItems.map((i) => ({ price: i.product.price, qty: i.qty })));
  const grandTotal = totals.grandTotal + tip;

  // Any "Aur kuch?" add-on was already decided on the cart page, before
  // payment — carry it onto the order for the record (tracking-page "·
  // aur kuch" tag, the post-delivery rating follow-up, and instrumentation).
  const addOnItem = cartItems.find((i) => i.isAddOn);

  const order = await db.order.create({
    data: {
      sessionPersonaId: sp.id,
      isSeedHistory: false,
      placedAtSimDay: sp.simDay,
      itemTotal: totals.itemTotal,
      deliveryFee: totals.deliveryFee,
      handlingFee: totals.handlingFee,
      tip,
      grandTotal,
      suggestionSurfaceShown: addOnItem ? "CART" : undefined,
      suggestionAttribute: addOnItem?.addOnAttribute ?? undefined,
      suggestionTier: addOnItem ? "ASSERT" : undefined,
      items: {
        create: cartItems.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          priceAtPurchase: i.product.price,
          isAddOn: i.isAddOn,
        })),
      },
    },
  });

  const purchasedLeaks = new Set(
    cartItems
      .map((i) => leakCategoryOf(i.product.category, i.product.subcategory))
      .filter((c): c is LeakCategoryKey => c !== null)
  );
  const addOnLeakCategory = addOnItem ? leakCategoryOf(addOnItem.product.category, addOnItem.product.subcategory) : null;

  await db.cartItem.deleteMany({ where: { sessionPersonaId: sp.id } });
  // Fresh one-suggestion-per-checkout budget for the next cart.
  await db.sessionPersona.update({
    where: { id: sp.id },
    data: { cartSuggestionShown: false, cartSuggestionSpent: false },
  });

  // Recompute the household graph after every order (brief requirement) so
  // the NEXT cart view reflects this order's contents. Graceful AI failure:
  // on error, keep the previous graph.
  try {
    await recomputeGraph(sp.id);
    await logRepeatsWithoutSuggestion(sp.id, order.id, purchasedLeaks, addOnLeakCategory);
  } catch (err) {
    console.error("post-order graph recompute failed", err);
  }

  revalidatePath("/", "layout");
  return order.id;
}

export async function submitRating(orderId: string, stars: number, answer: string | null) {
  const sp = await getOrCreateSessionPersona();
  const order = await db.order.update({
    where: { id: orderId },
    data: { ratingStars: stars, ratingAnswer: answer },
  });

  // Close the loop: a negative "didn't work out" answer on a first-ever
  // add-on purchase writes back to the graph and visibly changes the next
  // suggestion (silences that leak going forward), same as two declines.
  if (answer === "not_quite" && order.suggestionAttribute) {
    const attr = await db.graphAttribute.findUnique({
      where: { sessionPersonaId_attribute: { sessionPersonaId: sp.id, attribute: order.suggestionAttribute } },
    });
    if (attr?.leakCategory) {
      const leakCategory = attr.leakCategory as LeakCategoryKey;
      await db.categorySuppression.upsert({
        where: { sessionPersonaId_category: { sessionPersonaId: sp.id, category: leakCategory } },
        update: { suppressedUntilSimDay: sp.simDay + 30 },
        create: { sessionPersonaId: sp.id, category: leakCategory, declineCount: 0, suppressedUntilSimDay: sp.simDay + 30 },
      });
      await db.suggestionEvent.create({
        data: {
          sessionPersonaId: sp.id,
          orderId,
          type: "SUPPRESSED",
          attribute: order.suggestionAttribute,
          category: leakCategory,
          surface: "RATING",
          metadata: { reason: "negative_rating_followup" },
        },
      });
    }
  }

  revalidatePath(`/orders/${orderId}`);
}

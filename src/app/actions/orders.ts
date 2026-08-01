"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { computeTotals } from "@/lib/pricing";
import { recomputeGraph } from "@/lib/graph/engine";
import {
  chooseSuggestion,
  recordSuggestionShown,
  respondNotNow,
  respondAskAnswer,
  logRepeatsWithoutSuggestion,
  leakCategoryOf,
} from "@/lib/suggestion";
import type { LeakCategoryKey } from "@/lib/attributes";
import type { AttributeKey } from "@/lib/attributes";

export async function placeOrder(tip: number): Promise<string> {
  const sp = await getOrCreateSessionPersona();
  const cartItems = await db.cartItem.findMany({
    where: { sessionPersonaId: sp.id },
    include: { product: true },
  });
  if (cartItems.length === 0) throw new Error("Cart is empty");

  const totals = computeTotals(cartItems.map((i) => ({ price: i.product.price, qty: i.qty })));
  const grandTotal = totals.grandTotal + tip;

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
      items: {
        create: cartItems.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          priceAtPurchase: i.product.price,
        })),
      },
    },
  });

  const purchasedLeaks = new Set(
    cartItems
      .map((i) => leakCategoryOf(i.product.category, i.product.subcategory))
      .filter((c): c is LeakCategoryKey => c !== null)
  );

  await db.cartItem.deleteMany({ where: { sessionPersonaId: sp.id } });

  // Recompute the household graph after every order (brief requirement).
  // Graceful AI failure: on error, keep the previous graph and simply skip
  // choosing a fresh suggestion for this order.
  try {
    await recomputeGraph(sp.id);
    const choice = await chooseSuggestion(sp.id);
    if (choice) {
      await recordSuggestionShown(order.id, sp.id, choice, "TRACKING");
    }
    await logRepeatsWithoutSuggestion(sp.id, order.id, purchasedLeaks, choice?.leakCategory ?? null);
  } catch (err) {
    console.error("post-order suggestion pipeline failed", err);
  }

  revalidatePath("/", "layout");
  return order.id;
}

export async function addSuggestedItem(orderId: string, productId: string) {
  const sp = await getOrCreateSessionPersona();
  const [order, product] = await Promise.all([
    db.order.findUniqueOrThrow({ where: { id: orderId } }),
    db.product.findUniqueOrThrow({ where: { id: productId } }),
  ]);

  await db.orderItem.create({
    data: { orderId, productId, qty: 1, priceAtPurchase: product.price, isAddOn: true },
  });
  const newItemTotal = order.itemTotal + product.price;
  await db.order.update({
    where: { id: orderId },
    data: { itemTotal: newItemTotal, grandTotal: newItemTotal + order.deliveryFee + order.handlingFee + order.tip },
  });

  let leakCategory: string | undefined;
  if (order.suggestionAttribute) {
    const attr = await db.graphAttribute.findUnique({
      where: { sessionPersonaId_attribute: { sessionPersonaId: sp.id, attribute: order.suggestionAttribute } },
    });
    leakCategory = attr?.leakCategory ?? undefined;
  }

  await db.suggestionEvent.create({
    data: {
      sessionPersonaId: sp.id,
      orderId,
      type: "TAPPED_ADD",
      attribute: order.suggestionAttribute ?? undefined,
      category: leakCategory,
      productId,
      surface: "TRACKING",
    },
  });

  revalidatePath(`/orders/${orderId}`);
}

export async function declineSuggestion(orderId: string, leakCategory: LeakCategoryKey) {
  const sp = await getOrCreateSessionPersona();
  await respondNotNow(orderId, sp.id, leakCategory);
  revalidatePath(`/orders/${orderId}`);
}

export async function answerAsk(attribute: AttributeKey, answeredYes: boolean, orderId: string) {
  const sp = await getOrCreateSessionPersona();
  const product = await respondAskAnswer(orderId, sp.id, attribute, answeredYes);
  revalidatePath(`/orders/${orderId}`);
  return product;
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

import "server-only";
import { db } from "@/lib/db";
import { ATTRIBUTES, LEAK_CATEGORY_TAXONOMY, type AttributeKey, type LeakCategoryKey } from "@/lib/attributes";
import { LEAK_CATEGORY_SKUS } from "@/data/seed";

export interface SuggestionChoice {
  attribute: AttributeKey;
  tier: "ASSERT" | "ASK";
  leakCategory: LeakCategoryKey;
  evidence: string;
  justification: string;
  question?: string;
  productId?: string;
  productName?: string;
  productPrice?: number;
  productMrp?: number;
  productPackSize?: string;
  productEmoji?: string;
  productColorFrom?: string;
  productColorTo?: string;
}

async function suppressedCategories(sessionPersonaId: string, simDay: number): Promise<Set<string>> {
  const rows = await db.categorySuppression.findMany({ where: { sessionPersonaId } });
  const set = new Set<string>();
  for (const row of rows) {
    if (row.suppressedUntilSimDay !== null && simDay < row.suppressedUntilSimDay) {
      set.add(row.category);
    }
  }
  return set;
}

/**
 * Chooses the single best-eligible suggestion for this household right now,
 * or null if none qualifies (VIKRAM's silence path). Enforces: leak category
 * not already purchased (handled upstream in engine.ts), not already in the
 * excludeCategories set (e.g. current cart contents), and not under active
 * 30-day suppression from two prior declines.
 */
export async function chooseSuggestion(
  sessionPersonaId: string,
  excludeLeakCategories: Set<LeakCategoryKey> = new Set()
): Promise<SuggestionChoice | null> {
  const sessionPersona = await db.sessionPersona.findUniqueOrThrow({ where: { id: sessionPersonaId } });
  const [attrs, suppressed] = await Promise.all([
    db.graphAttribute.findMany({
      where: { sessionPersonaId, tier: { in: ["ASSERT", "ASK"] } },
      orderBy: { confidence: "desc" },
    }),
    suppressedCategories(sessionPersonaId, sessionPersona.simDay),
  ]);

  for (const attr of attrs) {
    if (!attr.leakCategory) continue;
    const leakCategory = attr.leakCategory as LeakCategoryKey;
    if (suppressed.has(leakCategory)) continue;
    if (excludeLeakCategories.has(leakCategory)) continue;

    const def = ATTRIBUTES[attr.attribute as AttributeKey];
    if (!def) continue;

    if (attr.tier === "ASK") {
      return {
        attribute: def.key,
        tier: "ASK",
        leakCategory,
        evidence: attr.evidence,
        justification: attr.justification,
        question: def.askQuestion,
      };
    }

    // ASSERT — resolve the recommended (trial-pack) product for this leak.
    const sku = LEAK_CATEGORY_SKUS[leakCategory];
    const product = sku ? await db.product.findUnique({ where: { sku } }) : null;
    if (!product || !product.available) continue;

    return {
      attribute: def.key,
      tier: "ASSERT",
      leakCategory,
      evidence: attr.evidence,
      justification: attr.justification,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productMrp: product.mrp,
      productPackSize: product.packSize,
      productEmoji: product.emoji,
      productColorFrom: product.colorFrom,
      productColorTo: product.colorTo,
    };
  }

  return null;
}

/** Logs the "shown" funnel event exactly once per cart-checkout cycle —
 * guarded by SessionPersona.cartSuggestionShown, the same
 * check-a-flag-then-write pattern `ensureDeliveredLogged` uses for orders. */
export async function ensureCartSuggestionShownLogged(
  sessionPersonaId: string,
  alreadyShown: boolean,
  choice: SuggestionChoice
) {
  if (alreadyShown) return;
  await db.suggestionEvent.create({
    data: {
      sessionPersonaId,
      type: choice.tier === "ASSERT" ? "SHOWN_ASSERT" : "SHOWN_ASK",
      attribute: choice.attribute,
      category: choice.leakCategory,
      productId: choice.productId,
      surface: "CART",
    },
  });
  await db.sessionPersona.update({ where: { id: sessionPersonaId }, data: { cartSuggestionShown: true } });
}

async function bumpSuppression(sessionPersonaId: string, leakCategory: LeakCategoryKey, simDay: number) {
  const existing = await db.categorySuppression.findUnique({
    where: { sessionPersonaId_category: { sessionPersonaId, category: leakCategory } },
  });
  const declineCount = (existing?.declineCount ?? 0) + 1;
  await db.categorySuppression.upsert({
    where: { sessionPersonaId_category: { sessionPersonaId, category: leakCategory } },
    update: {
      declineCount,
      suppressedUntilSimDay: declineCount >= 2 ? simDay + 30 : existing?.suppressedUntilSimDay ?? null,
    },
    create: {
      sessionPersonaId,
      category: leakCategory,
      declineCount,
      suppressedUntilSimDay: declineCount >= 2 ? simDay + 30 : null,
    },
  });
  if (declineCount >= 2) {
    await db.suggestionEvent.create({
      data: {
        sessionPersonaId,
        type: "SUPPRESSED",
        category: leakCategory,
        surface: "CART",
        metadata: { declineCount },
      },
    });
  }
}

export async function respondNotNow(sessionPersonaId: string, leakCategory: LeakCategoryKey) {
  const sessionPersona = await db.sessionPersona.findUniqueOrThrow({ where: { id: sessionPersonaId } });
  await db.suggestionEvent.create({
    data: { sessionPersonaId, type: "TAPPED_NOT_NOW", category: leakCategory, surface: "CART" },
  });
  await bumpSuppression(sessionPersonaId, leakCategory, sessionPersona.simDay);
}

/**
 * Records the user's answer to an ASK-tier question, on the cart page
 * before checkout. On "yes", also upgrades the household graph to ASSERT
 * and resolves + returns the recommended product immediately, so the cart
 * can add it to the same order-in-progress instead of waiting for the next
 * order's inference pass.
 */
export async function respondAskAnswer(sessionPersonaId: string, attribute: AttributeKey, answeredYes: boolean) {
  const def = ATTRIBUTES[attribute];
  const existing = await db.graphAttribute.findUnique({
    where: { sessionPersonaId_attribute: { sessionPersonaId, attribute } },
  });
  await db.graphAttribute.update({
    where: { sessionPersonaId_attribute: { sessionPersonaId, attribute } },
    data: {
      answeredYes,
      tier: answeredYes ? "ASSERT" : "SILENCE",
      confidence: answeredYes ? Math.max(existing?.confidence ?? 0, 0.9) : existing?.confidence ?? 0,
      leakCategory: answeredYes ? def.leakCategory : null,
    },
  });
  await db.suggestionEvent.create({
    data: {
      sessionPersonaId,
      type: answeredYes ? "ASK_ANSWERED_YES" : "ASK_ANSWERED_NO",
      attribute,
      category: def.leakCategory,
      surface: "CART",
    },
  });

  if (!answeredYes) return null;

  const sku = LEAK_CATEGORY_SKUS[def.leakCategory];
  const product = sku ? await db.product.findUnique({ where: { sku } }) : null;
  return product && product.available ? product : null;
}

/** Instrumentation: detect a household organically repeat-purchasing a
 * known-leak category on an order where no suggestion was added for it —
 * the funnel step the brief calls out as the metric that matters most. */
export async function logRepeatsWithoutSuggestion(
  sessionPersonaId: string,
  orderId: string,
  purchasedLeakCategories: Set<LeakCategoryKey>,
  suggestedLeakCategory: LeakCategoryKey | null
) {
  const attrs = await db.graphAttribute.findMany({
    where: { sessionPersonaId, leakCategory: { not: null } },
  });
  const knownLeaks = new Set(attrs.map((a) => a.leakCategory as LeakCategoryKey));

  for (const cat of purchasedLeakCategories) {
    if (cat === suggestedLeakCategory) continue;
    if (!knownLeaks.has(cat)) continue;
    await db.suggestionEvent.create({
      data: {
        sessionPersonaId,
        orderId,
        type: "REPEAT_WITHOUT_SUGGESTION",
        category: cat,
        surface: "CART",
      },
    });
  }
}

export function leakCategoryOf(productCategory: string, productSubcategory: string): LeakCategoryKey | null {
  for (const [key, taxonomy] of Object.entries(LEAK_CATEGORY_TAXONOMY)) {
    if (taxonomy.category !== productCategory) continue;
    if (taxonomy.subcategory && taxonomy.subcategory !== productSubcategory) continue;
    return key as LeakCategoryKey;
  }
  return null;
}

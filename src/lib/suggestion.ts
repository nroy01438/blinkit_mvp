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
    };
  }

  return null;
}

export async function recordSuggestionShown(orderId: string, sessionPersonaId: string, choice: SuggestionChoice, surface: "TRACKING" | "CART") {
  await db.order.update({
    where: { id: orderId },
    data: {
      suggestionSurfaceShown: surface,
      suggestionAttribute: choice.attribute,
      suggestionTier: choice.tier,
    },
  });
  await db.suggestionEvent.create({
    data: {
      sessionPersonaId,
      orderId,
      type: choice.tier === "ASSERT" ? "SHOWN_ASSERT" : "SHOWN_ASK",
      attribute: choice.attribute,
      category: choice.leakCategory,
      productId: choice.productId,
      surface,
    },
  });
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
        surface: "TRACKING",
        metadata: { declineCount },
      },
    });
  }
}

export async function respondNotNow(orderId: string, sessionPersonaId: string, leakCategory: LeakCategoryKey) {
  const sessionPersona = await db.sessionPersona.findUniqueOrThrow({ where: { id: sessionPersonaId } });
  await db.suggestionEvent.create({
    data: { sessionPersonaId, orderId, type: "TAPPED_NOT_NOW", category: leakCategory, surface: "TRACKING" },
  });
  await bumpSuppression(sessionPersonaId, leakCategory, sessionPersona.simDay);
}

/**
 * Records the user's answer to an ASK-tier question. On "yes", also
 * upgrades the household graph to ASSERT and resolves + returns the
 * recommended product immediately, so the tracking screen can swap the
 * question straight for a product card in the same order instead of
 * waiting for the next order's inference pass.
 */
export async function respondAskAnswer(
  orderId: string,
  sessionPersonaId: string,
  attribute: AttributeKey,
  answeredYes: boolean
) {
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
      orderId,
      type: answeredYes ? "ASK_ANSWERED_YES" : "ASK_ANSWERED_NO",
      attribute,
      category: def.leakCategory,
      surface: "TRACKING",
    },
  });

  if (!answeredYes) return null;

  await db.order.update({ where: { id: orderId }, data: { suggestionTier: "ASSERT" } });

  const sku = LEAK_CATEGORY_SKUS[def.leakCategory];
  const product = sku ? await db.product.findUnique({ where: { sku } }) : null;
  return product && product.available ? product : null;
}

/** Instrumentation: detect a household organically repeat-purchasing a
 * known-leak category on an order where no suggestion was shown for it —
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
        surface: "TRACKING",
      },
    });
  }
}

/** Reconstructs the full display payload for an order's already-chosen
 * suggestion (persisted at placeOrder time) so the tracking page can render
 * it without re-running inference. */
export async function getOrderSuggestionDisplay(
  order: { id: string; suggestionAttribute: string | null; suggestionTier: string | null },
  sessionPersonaId: string
) {
  if (!order.suggestionAttribute || !order.suggestionTier || order.suggestionTier === "SILENCE") return null;
  const def = ATTRIBUTES[order.suggestionAttribute as AttributeKey];
  if (!def) return null;

  const attrRow = await db.graphAttribute.findUnique({
    where: { sessionPersonaId_attribute: { sessionPersonaId, attribute: order.suggestionAttribute } },
  });
  if (!attrRow || !attrRow.leakCategory) return null;
  const leakCategory = attrRow.leakCategory as LeakCategoryKey;

  const base = {
    attribute: def.key,
    leakCategory,
    justification: attrRow.justification,
    evidence: attrRow.evidence,
  };

  if (order.suggestionTier === "ASK") {
    return { ...base, tier: "ASK" as const, question: def.askQuestion };
  }

  const sku = LEAK_CATEGORY_SKUS[leakCategory];
  const product = sku ? await db.product.findUnique({ where: { sku } }) : null;
  if (!product) return null;
  return { ...base, tier: "ASSERT" as const, product };
}

/**
 * Whether this order's suggestion is fully resolved and should render as a
 * static "already handled" line instead of an interactive card. Answering
 * an ASK "yes" is deliberately excluded — it upgrades the order to ASSERT
 * (see respondAskAnswer) and the interaction continues into that product
 * card, so it must still render interactively until added or declined.
 */
export async function orderHasSuggestionResponse(orderId: string): Promise<boolean> {
  const count = await db.suggestionEvent.count({
    where: {
      orderId,
      type: { in: ["TAPPED_ADD", "TAPPED_NOT_NOW", "ASK_ANSWERED_NO"] },
    },
  });
  return count > 0;
}

/** Read-only cart-page preview: only ever surfaces high-confidence (ASSERT)
 * suggestions, as a quiet one-line aside. Never logs an event or consumes
 * the per-order hard cap — the interactive suggestion (with Add / Not now
 * and guardrail-affecting logging) lives exclusively on the tracking
 * screen once the order exists. */
export async function previewCartSuggestion(
  sessionPersonaId: string,
  excludeLeakCategories: Set<LeakCategoryKey>
): Promise<SuggestionChoice | null> {
  const choice = await chooseSuggestion(sessionPersonaId, excludeLeakCategories);
  if (choice?.tier === "ASSERT") return choice;
  return null;
}

export function leakCategoryOf(productCategory: string, productSubcategory: string): LeakCategoryKey | null {
  for (const [key, taxonomy] of Object.entries(LEAK_CATEGORY_TAXONOMY)) {
    if (taxonomy.category !== productCategory) continue;
    if (taxonomy.subcategory && taxonomy.subcategory !== productSubcategory) continue;
    return key as LeakCategoryKey;
  }
  return null;
}

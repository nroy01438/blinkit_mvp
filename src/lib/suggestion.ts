import "server-only";
import { db } from "@/lib/db";
import { ATTRIBUTES, LEAK_CATEGORY_TAXONOMY, type AttributeKey, type LeakCategoryKey } from "@/lib/attributes";
import { LEAK_CATEGORY_SKUS } from "@/data/seed";

export interface SuggestionChoice {
  attribute: AttributeKey;
  leakCategory: LeakCategoryKey;
  evidence: string;
  justification: string;
  productId: string;
  productName: string;
  productPrice: number;
  productMrp: number;
  productPackSize: string;
  productEmoji: string;
  productColorFrom: string;
  productColorTo: string;
}

/** Picks one product to represent a leak category — at random among the
 * category's candidates, preferring ones this household hasn't already
 * bought, so the same inferred fact doesn't always surface the identical
 * SKU (e.g. infant_present can resolve to diapers, wipes, baby soap, baby
 * oil...). Falls back to any available candidate if they've somehow bought
 * every option already. */
async function pickLeakProduct(sessionPersonaId: string, leakCategory: LeakCategoryKey) {
  const skus = LEAK_CATEGORY_SKUS[leakCategory] ?? [];
  if (skus.length === 0) return null;

  const [candidates, purchasedItems] = await Promise.all([
    db.product.findMany({ where: { sku: { in: skus }, available: true } }),
    db.orderItem.findMany({ where: { order: { sessionPersonaId } }, select: { productId: true } }),
  ]);
  if (candidates.length === 0) return null;

  const purchasedIds = new Set(purchasedItems.map((i) => i.productId));
  const fresh = candidates.filter((p) => !purchasedIds.has(p.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
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

/** Generic, non-graph-specific copy for the last-resort fallback passes
 * below — used when the graph doesn't (yet) have a confident, unsuppressed
 * read, so the card can't honestly claim a specific household insight. */
const GENERIC_FALLBACK_JUSTIFICATION = "Kaafi log ek saath yeh bhi le lete hain — try karein? 🙂";

/** Priority order for a household with no graph signal at all yet (a
 * guest's very first-ever cart, before any order has been placed to infer
 * from) — broadly-applicable categories first, narrow/specific ones
 * (pets, infant, elderly) last since guessing those blind is a stretch. */
const GENERIC_FALLBACK_ATTRIBUTE_ORDER: AttributeKey[] = [
  "new_home",
  "large_household",
  "vegetarian_household",
  "frequent_hosting",
  "fitness_routine",
  "pet_dog",
  "pet_cat",
  "elderly_member",
  "toddler_present",
  "infant_present",
];

type GraphAttributeRow = Awaited<ReturnType<typeof db.graphAttribute.findMany>>[number];

async function firstEligible(
  sessionPersonaId: string,
  attrs: GraphAttributeRow[],
  excludeLeakCategories: Set<LeakCategoryKey>,
  suppressed: Set<string>,
  ignoreSuppression: boolean
) {
  for (const attr of attrs) {
    if (!attr.leakCategory) continue;
    const leakCategory = attr.leakCategory as LeakCategoryKey;
    if (!ignoreSuppression && suppressed.has(leakCategory)) continue;
    if (excludeLeakCategories.has(leakCategory)) continue;

    const def = ATTRIBUTES[attr.attribute as AttributeKey];
    if (!def) continue;

    const product = await pickLeakProduct(sessionPersonaId, leakCategory);
    if (!product) continue;

    return { attr, def, leakCategory, product };
  }
  return null;
}

/**
 * Chooses the single best-eligible suggestion for this household right now.
 * A demo where checkout can complete with no "Aur kuch?" nudge at all reads
 * as broken, so this always returns a product for a non-empty cart via a
 * tiered fallback, each pass more permissive than the last:
 *
 *   1. A confident (ASSERT) read, not suppressed, not already in the cart —
 *      the normal, fully-personalized path.
 *   2. Same confident reads, but ignoring an active 30-day suppression —
 *      covers the edge case where every confident signal this household has
 *      happens to be cooling down from two prior declines.
 *   3. Any graph read at all (even below the ASSERT bar), ignoring
 *      suppression — the household's best circumstantial signal, framed
 *      with generic copy instead of an overconfident claim.
 *   4. No graph signal exists yet at all (a guest's very first-ever cart,
 *      before any order has been placed to infer from) — a fixed,
 *      broadly-safe starter suggestion instead of nothing.
 *
 * Only returns null if every leak category collides with what's already in
 * the cart (handled upstream in engine.ts for already-purchased history) —
 * i.e. there is genuinely nothing left to suggest.
 */
export async function chooseSuggestion(
  sessionPersonaId: string,
  excludeLeakCategories: Set<LeakCategoryKey> = new Set()
): Promise<SuggestionChoice | null> {
  const sessionPersona = await db.sessionPersona.findUniqueOrThrow({ where: { id: sessionPersonaId } });
  const [allAttrs, suppressed] = await Promise.all([
    db.graphAttribute.findMany({ where: { sessionPersonaId }, orderBy: { confidence: "desc" } }),
    suppressedCategories(sessionPersonaId, sessionPersona.simDay),
  ]);
  const assertAttrs = allAttrs.filter((a) => a.tier === "ASSERT");

  const hit =
    (await firstEligible(sessionPersonaId, assertAttrs, excludeLeakCategories, suppressed, false)) ??
    (await firstEligible(sessionPersonaId, assertAttrs, excludeLeakCategories, suppressed, true)) ??
    (await firstEligible(sessionPersonaId, allAttrs, excludeLeakCategories, suppressed, true));

  if (hit) {
    return {
      attribute: hit.def.key,
      leakCategory: hit.leakCategory,
      evidence: hit.attr.evidence,
      justification: hit.attr.tier === "ASSERT" ? hit.attr.justification : GENERIC_FALLBACK_JUSTIFICATION,
      productId: hit.product.id,
      productName: hit.product.name,
      productPrice: hit.product.price,
      productMrp: hit.product.mrp,
      productPackSize: hit.product.packSize,
      productEmoji: hit.product.emoji,
      productColorFrom: hit.product.colorFrom,
      productColorTo: hit.product.colorTo,
    };
  }

  // Pass 4: no graph rows exist at all yet (guest, pre-first-order).
  for (const key of GENERIC_FALLBACK_ATTRIBUTE_ORDER) {
    const def = ATTRIBUTES[key];
    const leakCategory = def.leakCategory;
    if (excludeLeakCategories.has(leakCategory)) continue;

    const product = await pickLeakProduct(sessionPersonaId, leakCategory);
    if (!product) continue;

    return {
      attribute: def.key,
      leakCategory,
      evidence: "First order — no purchase history yet to personalize from.",
      justification: GENERIC_FALLBACK_JUSTIFICATION,
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
      type: "SHOWN_ASSERT",
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

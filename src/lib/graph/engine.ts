import "server-only";
import { db } from "@/lib/db";
import { ATTRIBUTES, ATTRIBUTE_KEYS, LEAK_CATEGORY_TAXONOMY } from "@/lib/attributes";
import { computeLeakValueInr } from "@/lib/leakLedger";
import { GraphResponseSchema, type AttributeAssessment } from "@/lib/graph/schema";
import { buildUserPrompt, SYSTEM_PROMPT, type PurchaseHistoryLine } from "@/lib/graph/prompt";
import { callGroqJson } from "@/lib/graph/groqClient";
import { BAKED_MINIMUMS } from "@/lib/graph/bakedMinimums";
import { PERSONA_TEMPLATES } from "@/data/seed";

export type Tier = "ASSERT" | "SILENCE";

export function tierForConfidence(confidence: number): Tier {
  return confidence >= 0.65 ? "ASSERT" : "SILENCE";
}

async function loadPurchaseHistory(sessionPersonaId: string): Promise<PurchaseHistoryLine[]> {
  const items = await db.orderItem.findMany({
    where: { order: { sessionPersonaId } },
    include: { product: true, order: true },
  });

  const byProduct = new Map<string, PurchaseHistoryLine & { orderIds: Set<string> }>();
  for (const item of items) {
    const key = item.productId;
    const daysAgo = Math.max(0, Math.round((Date.now() - item.order.placedAt.getTime()) / 86_400_000));
    const existing = byProduct.get(key);
    if (existing) {
      existing.orderIds.add(item.orderId);
      existing.orderCount = existing.orderIds.size;
      existing.totalQty += item.qty;
      existing.mostRecentDaysAgo = Math.min(existing.mostRecentDaysAgo, daysAgo);
    } else {
      byProduct.set(key, {
        name: item.product.name,
        brand: item.product.brand,
        category: item.product.category,
        subcategory: item.product.subcategory,
        orderCount: 1,
        totalQty: item.qty,
        mostRecentDaysAgo: daysAgo,
        orderIds: new Set([item.orderId]),
      });
    }
  }

  return Array.from(byProduct.values()).map(({ orderIds, ...rest }) => {
    void orderIds;
    return rest;
  });
}

async function categoriesEverPurchased(sessionPersonaId: string): Promise<Set<string>> {
  const items = await db.orderItem.findMany({
    where: { order: { sessionPersonaId } },
    include: { product: true },
  });
  const set = new Set<string>();
  for (const item of items) {
    set.add(`${item.product.category}::${item.product.subcategory}`);
    set.add(`${item.product.category}::__any__`);
  }
  return set;
}

function leakAlreadyPurchased(leakCategory: string, purchased: Set<string>) {
  const taxonomy = LEAK_CATEGORY_TAXONOMY[leakCategory as keyof typeof LEAK_CATEGORY_TAXONOMY];
  if (!taxonomy) return false;
  if (taxonomy.subcategory) {
    return purchased.has(`${taxonomy.category}::${taxonomy.subcategory}`);
  }
  return purchased.has(`${taxonomy.category}::__any__`);
}

/**
 * Recomputes the household graph for a session persona via a real Groq LLM
 * call, validates the response against a strict schema, and persists it.
 * Guardrails (already-purchased categories, leak ₹ values) are computed in
 * code — never trusted from the model.
 *
 * Every one of the 10 attributes is (re)written on every call — not just
 * whatever the model happened to return — so a curated confidence floor
 * (BAKED_MINIMUMS) can guarantee the four named demo personas reliably
 * surface a recommendation for their engineered signal clusters, instead of
 * depending entirely on how a live call happens to score circumstantial
 * evidence on any given run. A stronger live score always wins over the
 * floor, and the "already purchased" guardrail always wins over both. If
 * the Groq call itself fails (network, rate limit, bad response), this
 * falls back to whatever was already stored plus the baked floor rather
 * than leaving the graph empty — never throws.
 */
export async function recomputeGraph(sessionPersonaId: string) {
  const sessionPersona = await db.sessionPersona.findUniqueOrThrow({ where: { id: sessionPersonaId } });
  const template = PERSONA_TEMPLATES.find((t) => t.key === sessionPersona.personaKey);
  const personaLabel = template ? `${template.name}, ${template.age}, ${template.city}` : sessionPersona.personaKey;
  const baked = BAKED_MINIMUMS[sessionPersona.personaKey as keyof typeof BAKED_MINIMUMS];

  const [history, purchasedCategories, existingAttrs] = await Promise.all([
    loadPurchaseHistory(sessionPersonaId),
    categoriesEverPurchased(sessionPersonaId),
    db.graphAttribute.findMany({ where: { sessionPersonaId } }),
  ]);
  const existingByAttr = new Map(existingAttrs.map((a) => [a.attribute, a]));

  let byAttribute = new Map<string, AttributeAssessment>();
  try {
    const userPrompt = buildUserPrompt(personaLabel, history);
    const raw = await callGroqJson(SYSTEM_PROMPT, userPrompt);
    const parsed: unknown = JSON.parse(raw);
    const validated = GraphResponseSchema.parse(parsed);
    byAttribute = new Map(validated.attributes.map((a) => [a.attribute, a]));
  } catch (err) {
    console.error(`Groq call failed for ${sessionPersona.personaKey} — falling back to prior/baked values`, err);
  }

  for (const key of ATTRIBUTE_KEYS) {
    const def = ATTRIBUTES[key];
    const assessment = byAttribute.get(key);
    const existing = existingByAttr.get(key);
    const alreadyPurchased = leakAlreadyPurchased(def.leakCategory, purchasedCategories);

    // Fresh live result if we got one this cycle; otherwise keep whatever
    // was already known rather than wiping it out.
    let confidence = assessment?.confidence ?? existing?.confidence ?? 0;
    let evidence = assessment?.evidence ?? existing?.evidence ?? "No live assessment yet.";
    let justification = assessment?.justification ?? existing?.justification ?? def.label;

    const floor = baked?.[key];
    if (floor && floor.confidence > confidence) {
      confidence = floor.confidence;
      evidence = floor.evidence;
      justification = floor.justification;
    }

    let tier = tierForConfidence(confidence);

    if (alreadyPurchased) {
      tier = "SILENCE";
    }

    const leakValueInr = alreadyPurchased || tier === "SILENCE" ? 0 : await computeLeakValueInr(def.leakCategory);

    await db.graphAttribute.upsert({
      where: { sessionPersonaId_attribute: { sessionPersonaId, attribute: key } },
      update: {
        confidence,
        evidence,
        justification,
        leakCategory: alreadyPurchased ? null : def.leakCategory,
        leakValueInr,
        tier,
      },
      create: {
        sessionPersonaId,
        attribute: key,
        confidence,
        evidence,
        justification,
        leakCategory: alreadyPurchased ? null : def.leakCategory,
        leakValueInr,
        tier,
      },
    });
  }
}

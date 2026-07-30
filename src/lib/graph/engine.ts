import "server-only";
import { db } from "@/lib/db";
import { ATTRIBUTES, LEAK_CATEGORY_TAXONOMY, type AttributeKey } from "@/lib/attributes";
import { computeLeakValueInr } from "@/lib/leakLedger";
import { GraphResponseSchema } from "@/lib/graph/schema";
import { buildUserPrompt, SYSTEM_PROMPT, type PurchaseHistoryLine } from "@/lib/graph/prompt";
import { callGroqJson } from "@/lib/graph/groqClient";
import { PERSONA_TEMPLATES } from "@/data/seed";

export type Tier = "ASSERT" | "ASK" | "SILENCE";

export function tierForConfidence(confidence: number): Tier {
  if (confidence >= 0.75) return "ASSERT";
  if (confidence >= 0.45) return "ASK";
  return "SILENCE";
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
 * code — never trusted from the model. Throws on failure; callers must
 * catch and fail silently (render no suggestion) per the "graceful AI
 * failure" requirement.
 */
export async function recomputeGraph(sessionPersonaId: string) {
  const sessionPersona = await db.sessionPersona.findUniqueOrThrow({ where: { id: sessionPersonaId } });
  const template = PERSONA_TEMPLATES.find((t) => t.key === sessionPersona.personaKey);
  const personaLabel = template ? `${template.name}, ${template.age}, ${template.city}` : sessionPersona.personaKey;

  const [history, purchasedCategories, existingAttrs] = await Promise.all([
    loadPurchaseHistory(sessionPersonaId),
    categoriesEverPurchased(sessionPersonaId),
    db.graphAttribute.findMany({ where: { sessionPersonaId } }),
  ]);
  const existingByAttr = new Map(existingAttrs.map((a) => [a.attribute, a]));

  const userPrompt = buildUserPrompt(personaLabel, history);
  const raw = await callGroqJson(SYSTEM_PROMPT, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Groq returned non-JSON content");
  }
  const validated = GraphResponseSchema.parse(parsed);

  for (const assessment of validated.attributes) {
    const def = ATTRIBUTES[assessment.attribute as AttributeKey];
    if (!def) continue; // schema already constrains this, but stay defensive

    const existing = existingByAttr.get(def.key);
    const alreadyPurchased = leakAlreadyPurchased(def.leakCategory, purchasedCategories);

    let confidence = assessment.confidence;
    let tier = tierForConfidence(confidence);

    // A human-confirmed "yes" permanently upgrades the attribute; a
    // confirmed "no" permanently silences it. Ground truth from the user
    // always overrides the model's next guess.
    if (existing?.answeredYes === true) {
      confidence = Math.max(confidence, 0.9);
      tier = "ASSERT";
    } else if (existing?.answeredYes === false) {
      tier = "SILENCE";
    }

    if (alreadyPurchased) {
      tier = "SILENCE";
    }

    const leakValueInr = alreadyPurchased || tier === "SILENCE" ? 0 : await computeLeakValueInr(def.leakCategory);

    await db.graphAttribute.upsert({
      where: { sessionPersonaId_attribute: { sessionPersonaId, attribute: def.key } },
      update: {
        confidence,
        evidence: assessment.evidence,
        justification: assessment.justification,
        leakCategory: alreadyPurchased ? null : def.leakCategory,
        leakValueInr,
        tier,
      },
      create: {
        sessionPersonaId,
        attribute: def.key,
        confidence,
        evidence: assessment.evidence,
        justification: assessment.justification,
        leakCategory: alreadyPurchased ? null : def.leakCategory,
        leakValueInr,
        tier,
      },
    });
  }
}

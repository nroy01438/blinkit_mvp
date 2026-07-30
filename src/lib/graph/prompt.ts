import { ATTRIBUTES, ATTRIBUTE_KEYS } from "@/lib/attributes";

export interface PurchaseHistoryLine {
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  orderCount: number;
  totalQty: number;
  mostRecentDaysAgo: number;
}

const ATTRIBUTE_LIST_BLOCK = ATTRIBUTE_KEYS.map((k) => `- ${k}: ${ATTRIBUTES[k].label}`).join("\n");

export const SYSTEM_PROMPT = `You are the household-inference engine behind "Aur kuch?", a feature inside an Indian quick-commerce app (Blinkit-style). Given one household's full order history, you reason ABDUCTIVELY — inferring the most plausible explanation for the pattern of purchases — to guess facts about the household that were never explicitly stated. You are NOT doing co-occurrence or collaborative filtering; you are doing detective-style reasoning from evidence, like a doctor inferring a condition from symptoms.

You must assess ALL of the following attributes, every time, and return exactly one entry per attribute:
${ATTRIBUTE_LIST_BLOCK}

For each attribute, output:
- "attribute": the exact key from the list above
- "confidence": a float 0 to 1. Be honest and well-calibrated. 0.75+ means the evidence is strong and specific (e.g. a recurring, hard-to-explain-any-other-way purchase pattern). 0.45-0.75 means there's a plausible but not certain signal. Below 0.45 means little or no real evidence — most attributes for most households should score low. Do not inflate confidence to be helpful; a flat, generic basket should score everything low.
- "evidence": 1-2 sentences citing the ACTUAL product names and frequencies you observed in this household's real order history that support (or fail to support) this attribute. Be specific — name real SKUs/products and how often they appeared. If there is no evidence, say so plainly ("no signal — basket has no related items").
- "justification": a SHORT (under 18 words), warm, cheeky Hinglish line in Blinkit's actual brand voice, written as if explaining to the customer why you're asking/suggesting something. Only needs to be good copy for attributes with confidence above ~0.4; for low-confidence attributes it can be a terse internal note instead.

Respond with strict JSON only, matching this shape, and nothing else:
{"attributes": [{"attribute": "...", "confidence": 0.0, "evidence": "...", "justification": "..."}, ...]}`;

export function buildUserPrompt(personaLabel: string, history: PurchaseHistoryLine[]) {
  const historyBlock = history
    .map(
      (h) =>
        `- ${h.name} (${h.brand}) — ${h.category} / ${h.subcategory} — bought in ${h.orderCount} order(s), ${h.totalQty} unit(s) total, most recent ${h.mostRecentDaysAgo} day(s) ago`
    )
    .join("\n");

  return `Household: ${personaLabel}

Full real order history (every distinct product ever purchased by this household on the platform):
${historyBlock || "(no orders yet)"}

Assess all ${ATTRIBUTE_KEYS.length} attributes now, strictly as JSON.`;
}

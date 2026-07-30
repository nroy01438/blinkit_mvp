import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { after } from "next/server";
import { db } from "@/lib/db";
import { PERSONA_TEMPLATES } from "@/data/seed";
import { computeTotals } from "@/lib/pricing";
import { recomputeGraph } from "@/lib/graph/engine";

export const SESSION_COOKIE = "ak_sid";
export const PERSONA_COOKIE = "ak_persona";
export type PersonaKey = "priya" | "rohit" | "ananya" | "vikram";

export async function getCookiePersonaKey(): Promise<PersonaKey> {
  const jar = await cookies();
  const val = jar.get(PERSONA_COOKIE)?.value;
  if (val === "priya" || val === "rohit" || val === "ananya" || val === "vikram") return val;
  return "priya";
}

export async function setCookiePersonaKey(key: PersonaKey) {
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function getSessionId(): Promise<string> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) {
    // Should always be set by middleware; fall back defensively for
    // server actions invoked in contexts middleware didn't touch.
    throw new Error("No session cookie found — middleware should have set one.");
  }
  return sid;
}

async function materializeSeedHistory(sessionPersonaId: string, personaKey: PersonaKey) {
  const template = PERSONA_TEMPLATES.find((t) => t.key === personaKey);
  if (!template) return;

  const allSkus = Array.from(new Set(template.orders.flatMap((o) => o.items.map((i) => i.sku))));
  const products = await db.product.findMany({ where: { sku: { in: allSkus } } });
  const bySku = new Map(products.map((p) => [p.sku, p]));

  for (const order of template.orders) {
    const lineItems = order.items
      .map((i) => {
        const product = bySku.get(i.sku);
        if (!product) return null;
        return { product, qty: i.qty };
      })
      .filter((x): x is { product: (typeof products)[number]; qty: number } => x !== null);
    if (lineItems.length === 0) continue;

    const totals = computeTotals(lineItems.map((l) => ({ price: l.product.price, qty: l.qty })));
    const placedAt = new Date(Date.now() - order.daysAgo * 24 * 60 * 60 * 1000);

    await db.order.create({
      data: {
        sessionPersonaId,
        isSeedHistory: true,
        placedAtSimDay: -order.daysAgo,
        placedAt,
        forcedStatus: "DELIVERED",
        deliveredAt: new Date(placedAt.getTime() + 35 * 60 * 1000),
        itemTotal: totals.itemTotal,
        deliveryFee: totals.deliveryFee,
        handlingFee: totals.handlingFee,
        grandTotal: totals.grandTotal,
        items: {
          create: lineItems.map((l) => ({
            productId: l.product.id,
            qty: l.qty,
            priceAtPurchase: l.product.price,
          })),
        },
      },
    });
  }
}

/**
 * Resolves (and lazily creates) the SessionPersona for the current visitor +
 * active persona cookie. On first creation, materializes that persona's
 * seed order history and kicks off a background household-graph inference
 * pass via `after()` so it doesn't block first paint.
 */
export const getOrCreateSessionPersona = cache(async function getOrCreateSessionPersona() {
  const sessionId = await getSessionId();
  const personaKey = await getCookiePersonaKey();

  await db.session.upsert({
    where: { id: sessionId },
    update: {},
    create: { id: sessionId },
  });

  const existing = await db.sessionPersona.findUnique({
    where: { sessionId_personaKey: { sessionId, personaKey } },
  });
  if (existing) return existing;

  const created = await db.sessionPersona.create({
    data: { sessionId, personaKey },
  });

  await materializeSeedHistory(created.id, personaKey);

  after(async () => {
    try {
      await recomputeGraph(created.id);
    } catch (err) {
      console.error("background graph warm-up failed", err);
    }
  });

  return created;
});

export async function resetSessionPersona(personaKey: PersonaKey) {
  const sessionId = await getSessionId();
  const existing = await db.sessionPersona.findUnique({
    where: { sessionId_personaKey: { sessionId, personaKey } },
  });
  if (existing) {
    await db.sessionPersona.delete({ where: { id: existing.id } });
  }
  return getOrCreateSessionPersona();
}

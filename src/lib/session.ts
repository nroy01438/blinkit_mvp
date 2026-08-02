import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/lib/db";
import { PERSONA_TEMPLATES } from "@/data/seed";
import { computeTotals } from "@/lib/pricing";
import { recomputeGraph } from "@/lib/graph/engine";

export const SESSION_COOKIE = "ak_sid";
export const PERSONA_COOKIE = "ak_persona";
export type PersonaKey = "priya" | "rohit" | "ananya" | "vikram" | "guest";

// The four named demo personas, each with an engineered order history —
// eagerly "baked" (seeded + inferred) for every session in the background
// so a judge switching tabs on /internal always finds a full household
// graph waiting, not "No guesses yet". Guest is deliberately excluded: it
// has no seed history, so its graph should stay genuinely blank until the
// visitor places a real order.
const NAMED_PERSONAS: PersonaKey[] = ["priya", "rohit", "ananya", "vikram"];

export async function getCookiePersonaKey(): Promise<PersonaKey> {
  const jar = await cookies();
  const val = jar.get(PERSONA_COOKIE)?.value;
  if (val === "priya" || val === "rohit" || val === "ananya" || val === "vikram" || val === "guest") return val;
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

async function createAndSeedPersona(sessionId: string, personaKey: PersonaKey) {
  const created = await db.sessionPersona.create({ data: { sessionId, personaKey } });
  await materializeSeedHistory(created.id, personaKey);
  return created;
}

/** Creates, seeds, and infers the household graph for a persona that
 * doesn't exist yet in this session — entirely in the background (the
 * caller wraps this in `after()`). Used both for the persona the visitor
 * is actively browsing as and to eagerly warm up the other named demo
 * personas. */
async function provisionPersonaFully(sessionId: string, personaKey: PersonaKey) {
  const created = await createAndSeedPersona(sessionId, personaKey);
  try {
    await recomputeGraph(created.id);
  } catch (err) {
    console.error(`background graph warm-up failed for ${personaKey}`, err);
  }
  return created;
}

/** A hard page load — browser refresh, a typed/pasted URL, a plain (non-JS)
 * link, or the initial visit — should start the demo over with an empty
 * cart, so leftover items from an earlier test run never carry forward.
 * Detected via the standard `Sec-Fetch-Dest` fetch-metadata header, which
 * browsers only set to "document" for an actual top-level navigation that
 * (re)loads the HTML document. Next's own client-side transitions — Link
 * clicks, the cart's intercepted-route drawer, router.refresh(), server
 * actions like adding an item to the cart — are all background fetches
 * (`Sec-Fetch-Dest: empty`), so ordinary in-app browsing never hits this. */
async function clearCartOnFreshNavigation(sessionPersonaId: string) {
  const hdrs = await headers();
  if (hdrs.get("sec-fetch-dest") !== "document") return;
  await db.cartItem.deleteMany({ where: { sessionPersonaId } });
}

/** Guest has no seed history, so its graph should only ever reflect real
 * orders it has actually placed — never a guess manufactured from "(no
 * orders yet)". Self-healing: if an older build left behind attribute rows
 * for a guest that still has zero real orders, wipe them so the dashboard
 * shows the honest blank state instead of stale pre-order guesses. */
async function cleanupStaleGuestGraph(sessionPersonaId: string) {
  const realOrders = await db.order.count({ where: { sessionPersonaId, isSeedHistory: false } });
  if (realOrders > 0) return;
  await db.graphAttribute.deleteMany({ where: { sessionPersonaId } });
}

/** Best-effort, self-healing warm-up: on every request, check which of the
 * four named demo personas this session is still missing and provision
 * them in the background. Once all four exist it's a single cheap no-op
 * lookup, so it's safe to call unconditionally. */
function scheduleOtherPersonaWarmup(sessionId: string, currentKey: PersonaKey) {
  after(async () => {
    const existingKeys = new Set(
      (await db.sessionPersona.findMany({ where: { sessionId }, select: { personaKey: true } })).map((p) => p.personaKey)
    );
    for (const key of NAMED_PERSONAS) {
      if (key === currentKey || existingKeys.has(key)) continue;
      await provisionPersonaFully(sessionId, key).catch((err) =>
        console.error(`background provisioning failed for ${key}`, err)
      );
    }
  });
}

/**
 * Resolves (and lazily creates) the SessionPersona for the current visitor +
 * active persona cookie. On first creation, materializes that persona's
 * seed order history and kicks off a background household-graph inference
 * pass via `after()` so it doesn't block first paint. Also eagerly warms up
 * the other named demo personas in the background (see
 * scheduleOtherPersonaWarmup) so the instrumentation dashboard is always
 * ready to show off, not just for whichever persona is currently active.
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
  if (existing) {
    if (personaKey === "guest") after(() => cleanupStaleGuestGraph(existing.id));
    await clearCartOnFreshNavigation(existing.id);
    scheduleOtherPersonaWarmup(sessionId, personaKey);
    return existing;
  }

  const created = await createAndSeedPersona(sessionId, personaKey);

  // Guest has no seed history to reason about yet — only run inference once
  // it has real orders (placeOrder() already triggers recomputeGraph after
  // every order). Every other persona gets the usual background warm-up.
  if (personaKey !== "guest") {
    after(async () => {
      try {
        await recomputeGraph(created.id);
      } catch (err) {
        console.error("background graph warm-up failed", err);
      }
    });
  }
  scheduleOtherPersonaWarmup(sessionId, personaKey);

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

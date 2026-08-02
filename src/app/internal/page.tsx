import Link from "next/link";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { ATTRIBUTES, LEAK_CATEGORY_LABELS } from "@/lib/attributes";
import { PERSONA_TEMPLATES } from "@/data/seed";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const TIER_COLOR: Record<string, string> = {
  ASSERT: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  ASK: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  SILENCE: "text-slate-500 border-slate-500/30 bg-slate-500/10",
};

const TIER_BAR_COLOR: Record<string, string> = {
  ASSERT: "bg-emerald-400",
  ASK: "bg-amber-400",
  SILENCE: "bg-slate-600",
};

const TIER_EXPLANATION: Record<string, string> = {
  ASSERT: "Confident enough to recommend a product outright.",
  ASK: "Not fully sure — asks a quick yes/no question first.",
  SILENCE: "Not enough evidence — says nothing rather than guess.",
};

const PERSONA_BLURBS: Record<string, string> = {
  priya: "New mom in Gurgaon. Her order history has quiet baby signals (Cerelac, frequent milk & egg restocks) buried in an ordinary grocery basket.",
  rohit: "Dog owner in Bengaluru. Cleaning supplies and snacks dominate the basket, with a dog-food order easy to miss.",
  ananya: "Fitness-focused shopper in Mumbai. Oats, eggs, peanut butter and bananas on repeat.",
  vikram: "Household generalist in Delhi. A broad, low-signal basket — the \"AI should mostly stay quiet\" control case.",
  guest: "A real, blank-slate visitor. No pre-built history — whatever the AI knows here, it learned live from orders actually placed.",
};

const EVENT_LABELS: Record<string, string> = {
  SHOWN_ASSERT: "AI showed a product recommendation",
  SHOWN_ASK: "AI asked a yes/no question",
  TAPPED_ADD: "Customer added the suggestion to cart",
  TAPPED_NOT_NOW: "Customer dismissed the suggestion",
  ASK_ANSWERED_YES: "Customer answered “Yes”",
  ASK_ANSWERED_NO: "Customer answered “No”",
  DELIVERED_WITH_ADDON: "Order delivered with the AI's add-on in it",
  REPEAT_WITHOUT_SUGGESTION: "Customer repeat-bought a known leak — AI said nothing",
  SUPPRESSED: "AI muted this topic (2 declines in a row)",
};

export default async function InternalDashboard({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const sp = await getOrCreateSessionPersona();
  const { persona: personaParam } = await searchParams;

  const allPersonas = await db.sessionPersona.findMany({
    where: { sessionId: sp.sessionId },
    orderBy: { createdAt: "asc" },
  });
  const active = allPersonas.find((p) => p.personaKey === personaParam) ?? sp;
  const activeTemplate = PERSONA_TEMPLATES.find((t) => t.key === active.personaKey);
  const activeName = activeTemplate?.name ?? "Guest";

  const [attributes, events, suppressions, allEvents] = await Promise.all([
    db.graphAttribute.findMany({ where: { sessionPersonaId: active.id }, orderBy: { confidence: "desc" } }),
    db.suggestionEvent.findMany({ where: { sessionPersonaId: active.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.categorySuppression.findMany({ where: { sessionPersonaId: active.id } }),
    db.suggestionEvent.findMany({ where: { sessionPersonaId: { in: allPersonas.map((p) => p.id) } } }),
  ]);

  const funnel = {
    shown: allEvents.filter((e) => e.type === "SHOWN_ASSERT" || e.type === "SHOWN_ASK").length,
    tapped: allEvents.filter((e) => e.type === "TAPPED_ADD" || e.type === "TAPPED_NOT_NOW").length,
    added: allEvents.filter((e) => e.type === "TAPPED_ADD").length,
    delivered: allEvents.filter((e) => e.type === "DELIVERED_WITH_ADDON").length,
    repeatWithoutSuggestion: allEvents.filter((e) => e.type === "REPEAT_WITHOUT_SUGGESTION").length,
  };

  const leakLedgerByPersona = new Map<string, number>();
  for (const p of allPersonas) {
    const attrs = p.id === active.id ? attributes : await db.graphAttribute.findMany({ where: { sessionPersonaId: p.id } });
    const total = attrs.filter((a) => a.tier !== "SILENCE").reduce((s, a) => s + a.leakValueInr, 0);
    leakLedgerByPersona.set(p.personaKey, total);
  }
  const activeLeakTotal = leakLedgerByPersona.get(active.personaKey) ?? 0;
  const aggregateLeakTotal = Array.from(leakLedgerByPersona.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-200 font-mono text-[13px]">
      <div className="border-b border-slate-800 bg-[#0F1520] px-5 py-3 sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-amber-400 font-bold">BEHIND THE SCENES — SAFE TO SHARE</p>
            <h1 className="text-[16px] font-bold text-white">Aur Kuch? — how the AI is deciding</h1>
          </div>
          <Link href="/" className="text-[11px] text-slate-400 hover:text-white border border-slate-700 rounded px-2 py-1">
            ← back to storefront
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-5 py-6 flex flex-col gap-6">
        {/* Explainer */}
        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[13px] font-bold text-white mb-2">What am I looking at?</h2>
          <p className="text-[12.5px] text-slate-300 leading-relaxed mb-2">
            <span className="font-bold text-white">The problem:</span> Blinkit doesn&apos;t know anything about a household beyond
            what&apos;s in the cart. So a new parent still buys diapers on Amazon, a dog owner still buys dog food on BigBasket —
            revenue that quietly &quot;leaks&quot; to other apps, order after order.
          </p>
          <p className="text-[12.5px] text-slate-300 leading-relaxed mb-2">
            <span className="font-bold text-white">The fix — &quot;Aur Kuch?&quot; (&quot;anything else?&quot;):</span> an LLM reads
            a household&apos;s <em>entire</em> real order history and infers unstated facts about them — a baby in the house, a
            dog, a gym habit, an elderly parent — then, at most, makes <em>one</em> relevant nudge on the cart page, before
            checkout, while there&apos;s still time to act on it. Never more than once per checkout, and never for something
            they already buy here.
          </p>
          <p className="text-[12.5px] text-slate-300 leading-relaxed mb-3">
            <span className="font-bold text-white">This page</span> is the AI&apos;s working — every guess it made, how confident
            it was, and whether the guess turned into a sale. Nothing here is customer-facing; it exists so anyone (you, a
            teammate, an investor) can audit the AI instead of taking its word for it.
          </p>
          <Link
            href="/?persona=priya"
            className="inline-block text-[11.5px] font-bold text-[#0B0F14] bg-emerald-400 hover:bg-emerald-300 rounded-md px-3 py-1.5"
          >
            See it live as Priya →
          </Link>
          <span className="text-[11px] text-slate-500 ml-2">
            add anything to cart, then look above the &quot;Proceed to Pay&quot; button.
          </span>
        </section>

        {/* Persona switcher */}
        <section>
          <p className="text-[11px] text-slate-500 mb-2">
            Four pre-built test shoppers with engineered order histories, plus a real blank-slate &quot;Guest.&quot; Pick one to see
            what the AI has concluded about them.
          </p>
          <div className="flex flex-wrap gap-2">
            {allPersonas.map((p) => {
              const t = PERSONA_TEMPLATES.find((tpl) => tpl.key === p.personaKey);
              return (
                <Link
                  key={p.id}
                  href={`/internal?persona=${p.personaKey}`}
                  className={`px-3 py-1.5 rounded text-[11px] border ${
                    p.id === active.id ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" : "border-slate-700 text-slate-400"
                  }`}
                >
                  {t?.name ?? "Guest"}
                </Link>
              );
            })}
          </div>
          {PERSONA_BLURBS[active.personaKey] && (
            <p className="text-[11.5px] text-slate-400 mt-2 italic">{PERSONA_BLURBS[active.personaKey]}</p>
          )}
        </section>

        {/* Stat cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard
            label={`Revenue at risk / month — ${activeName}`}
            value={`₹${activeLeakTotal}/mo`}
            accent="emerald"
            sub="Estimated spend this household is likely making elsewhere, on categories the AI is confident about."
          />
          <StatCard
            label="Revenue at risk / month — all test shoppers combined"
            value={`₹${aggregateLeakTotal}/mo`}
            accent="amber"
            sub="Same estimate, summed across every persona tried in this browser session."
          />
          <StatCard
            label="Missed moments"
            value={String(funnel.repeatWithoutSuggestion)}
            accent="rose"
            sub="Customer repeat-bought something the AI already knew about, and the AI said nothing — the case we most want to shrink."
          />
        </section>

        {/* Funnel */}
        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12.5px] font-bold text-white mb-1 tracking-wide">Is the AI&apos;s pitch actually working?</h2>
          <p className="text-[11.5px] text-slate-500 mb-3">
            Every suggestion the AI has ever made across all personas in this session, tracked from &quot;shown&quot; to
            &quot;paid for.&quot;
          </p>
          <div className="flex items-stretch gap-1">
            <FunnelStep label="Shown" sub="AI spoke up" value={funnel.shown} />
            <FunnelArrow />
            <FunnelStep label="Tapped" sub="customer reacted" value={funnel.tapped} />
            <FunnelArrow />
            <FunnelStep label="Added" sub="added to cart" value={funnel.added} />
            <FunnelArrow />
            <FunnelStep label="Delivered w/ add-on" sub="order arrived with it" value={funnel.delivered} />
            <FunnelArrow />
            <FunnelStep label="Repeat w/o suggestion" sub="AI missed it" value={funnel.repeatWithoutSuggestion} highlight />
          </div>
        </section>

        {/* Tier distribution */}
        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12.5px] font-bold text-white mb-1 tracking-wide">How confident is the AI about {activeName}, right now?</h2>
          <p className="text-[11.5px] text-slate-500 mb-3">
            The AI checks 10 possible household facts on every order. Each one lands in exactly one bucket:
          </p>
          <div className="flex gap-3">
            {(["ASSERT", "ASK", "SILENCE"] as const).map((t) => (
              <div key={t} className={`flex-1 border rounded-md px-3 py-2 ${TIER_COLOR[t]}`}>
                <p className="text-[10px] tracking-wide font-bold">{t}</p>
                <p className="text-[20px] font-bold">{attributes.filter((a) => a.tier === t).length}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{TIER_EXPLANATION[t]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Household graph */}
        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12.5px] font-bold text-white mb-1 tracking-wide">What the AI has figured out about {activeName}</h2>
          <p className="text-[11.5px] text-slate-500 mb-3">
            Ranked most-to-least confident. &quot;Evidence&quot; is the AI&apos;s own explanation, quoting real products from this
            household&apos;s order history — never invented.
          </p>
          <div className="flex flex-col gap-2">
            {attributes.length === 0 && (
              <p className="text-slate-500 text-[12px]">No guesses yet — visit a page for this persona (or place an order) to trigger the AI.</p>
            )}
            {attributes.map((a) => (
              <div key={a.id} className="border border-slate-800 rounded-md p-3">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-[12px] font-bold text-white">{ATTRIBUTES[a.attribute as keyof typeof ATTRIBUTES]?.label ?? a.attribute}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400">{Math.round(a.confidence * 100)}% sure</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TIER_COLOR[a.tier]}`}>{a.tier}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${TIER_BAR_COLOR[a.tier]}`}
                    style={{ width: `${Math.round(a.confidence * 100)}%` }}
                  />
                </div>
                <p className="text-[11.5px] text-slate-400 mb-1">{a.evidence}</p>
                {a.leakCategory && (
                  <p className="text-[11px] text-emerald-400">
                    If true, we estimate this household spends ₹{a.leakValueInr}/mo elsewhere on{" "}
                    {LEAK_CATEGORY_LABELS[a.leakCategory as keyof typeof LEAK_CATEGORY_LABELS] ?? a.leakCategory}.
                  </p>
                )}
                {a.answeredYes !== null && (
                  <p className="text-[10.5px] text-amber-400 mt-1">Customer was asked directly and answered: {a.answeredYes ? "YES" : "NO"}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Suppression log */}
        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12.5px] font-bold text-white mb-1 tracking-wide">Topics the AI has learned to stop mentioning</h2>
          <p className="text-[11.5px] text-slate-500 mb-3">
            Say &quot;not now&quot; to the same suggestion twice and the AI mutes that topic for 30 days (simulated — fast-forward
            via the gear icon) instead of nagging.
          </p>
          {suppressions.length === 0 ? (
            <p className="text-slate-500 text-[12px]">Nothing muted yet for {activeName}.</p>
          ) : (
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="font-normal pb-1">Topic</th>
                  <th className="font-normal pb-1">Times declined</th>
                  <th className="font-normal pb-1">Muted until (simulated day)</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="py-1.5">{LEAK_CATEGORY_LABELS[s.category as keyof typeof LEAK_CATEGORY_LABELS] ?? s.category}</td>
                    <td className="py-1.5">{s.declineCount}</td>
                    <td className="py-1.5">{s.suppressedUntilSimDay ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Raw event log — collapsed, technical audience */}
        <details className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <summary className="text-[12.5px] font-bold text-white tracking-wide cursor-pointer select-none">
            Raw activity log (technical — click to expand)
          </summary>
          <p className="text-[11.5px] text-slate-500 mt-2 mb-3">
            Every event behind the numbers above, most recent first, for {activeName} only.
          </p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="font-normal pb-1">Time</th>
                <th className="font-normal pb-1">What happened</th>
                <th className="font-normal pb-1">Attribute</th>
                <th className="font-normal pb-1">Category</th>
                <th className="font-normal pb-1">Where</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-slate-800">
                  <td className="py-1 text-slate-500">{e.createdAt.toLocaleTimeString()}</td>
                  <td className="py-1 text-slate-200">{EVENT_LABELS[e.type] ?? e.type}</td>
                  <td className="py-1 text-slate-400">{e.attribute ?? "—"}</td>
                  <td className="py-1 text-slate-400">
                    {e.category ? LEAK_CATEGORY_LABELS[e.category as keyof typeof LEAK_CATEGORY_LABELS] ?? e.category : "—"}
                  </td>
                  <td className="py-1 text-slate-400">{e.surface ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent: "emerald" | "amber" | "rose"; sub?: string }) {
  const colors = {
    emerald: "border-emerald-400/30 text-emerald-400",
    amber: "border-amber-400/30 text-amber-400",
    rose: "border-rose-400/30 text-rose-400",
  }[accent];
  return (
    <div className={`border rounded-lg p-4 bg-[#0F1520] ${colors}`}>
      <p className="text-[10.5px] text-slate-400 mb-1 leading-snug">{label}</p>
      <p className="text-[22px] font-bold">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function FunnelStep({ label, sub, value, highlight }: { label: string; sub: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-md px-2 py-3 text-center border ${highlight ? "border-rose-400/40 bg-rose-400/10" : "border-slate-800"}`}>
      <p className={`text-[18px] font-bold ${highlight ? "text-rose-400" : "text-white"}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
      <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function FunnelArrow() {
  return <div className="flex items-center text-slate-700 px-0.5">→</div>;
}

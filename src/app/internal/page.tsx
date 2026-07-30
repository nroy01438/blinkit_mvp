import Link from "next/link";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { ATTRIBUTES } from "@/lib/attributes";
import { PERSONA_TEMPLATES } from "@/data/seed";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const TIER_COLOR: Record<string, string> = {
  ASSERT: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  ASK: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  SILENCE: "text-slate-500 border-slate-500/30 bg-slate-500/10",
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
            <p className="text-[10px] tracking-[0.2em] text-amber-400 font-bold">INTERNAL — NOT PART OF THE CONSUMER APP</p>
            <h1 className="text-[16px] font-bold text-white">Aur Kuch? — Instrumentation</h1>
          </div>
          <Link href="/" className="text-[11px] text-slate-400 hover:text-white border border-slate-700 rounded px-2 py-1">
            ← back to storefront
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-5 py-6 flex flex-col gap-6">
        <div className="flex gap-2">
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
                {t?.name ?? p.personaKey}
              </Link>
            );
          })}
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Leak Ledger — this persona" value={`₹${activeLeakTotal}/mo`} accent="emerald" />
          <StatCard label="Leak Ledger — aggregate (all personas this session)" value={`₹${aggregateLeakTotal}/mo`} accent="amber" />
          <StatCard
            label="Repeats WITHOUT a suggestion"
            value={String(funnel.repeatWithoutSuggestion)}
            accent="rose"
            sub="the metric that matters most"
          />
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12px] font-bold text-white mb-3 tracking-wide">FUNNEL — shown → tapped → added → delivered → repeated w/o suggestion</h2>
          <div className="flex items-stretch gap-1">
            <FunnelStep label="Shown" value={funnel.shown} />
            <FunnelArrow />
            <FunnelStep label="Tapped" value={funnel.tapped} />
            <FunnelArrow />
            <FunnelStep label="Added" value={funnel.added} />
            <FunnelArrow />
            <FunnelStep label="Delivered w/ add-on" value={funnel.delivered} />
            <FunnelArrow />
            <FunnelStep label="Repeat w/o suggestion" value={funnel.repeatWithoutSuggestion} highlight />
          </div>
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12px] font-bold text-white mb-3 tracking-wide">ASSERT / ASK / SILENCE DISTRIBUTION (active persona)</h2>
          <div className="flex gap-3">
            {(["ASSERT", "ASK", "SILENCE"] as const).map((t) => (
              <div key={t} className={`flex-1 border rounded-md px-3 py-2 ${TIER_COLOR[t]}`}>
                <p className="text-[10px] tracking-wide">{t}</p>
                <p className="text-[20px] font-bold">{attributes.filter((a) => a.tier === t).length}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12px] font-bold text-white mb-3 tracking-wide">HOUSEHOLD GRAPH — {active.personaKey}</h2>
          <div className="flex flex-col gap-2">
            {attributes.length === 0 && <p className="text-slate-500 text-[12px]">No graph computed yet — visit a page for this persona to trigger inference.</p>}
            {attributes.map((a) => (
              <div key={a.id} className="border border-slate-800 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold text-white">{ATTRIBUTES[a.attribute as keyof typeof ATTRIBUTES]?.label ?? a.attribute}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">conf {a.confidence.toFixed(2)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TIER_COLOR[a.tier]}`}>{a.tier}</span>
                  </div>
                </div>
                <p className="text-[11.5px] text-slate-400 mb-1">{a.evidence}</p>
                {a.leakCategory && (
                  <p className="text-[11px] text-emerald-400">
                    leak: {a.leakCategory} · ₹{a.leakValueInr}/mo
                  </p>
                )}
                {a.answeredYes !== null && (
                  <p className="text-[10.5px] text-amber-400 mt-1">user answered: {a.answeredYes ? "YES" : "NO"}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12px] font-bold text-white mb-3 tracking-wide">SUPPRESSION &amp; DECLINE LOG</h2>
          {suppressions.length === 0 ? (
            <p className="text-slate-500 text-[12px]">No suppressions yet.</p>
          ) : (
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="font-normal pb-1">Category</th>
                  <th className="font-normal pb-1">Declines</th>
                  <th className="font-normal pb-1">Suppressed until sim-day</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="py-1.5">{s.category}</td>
                    <td className="py-1.5">{s.declineCount}</td>
                    <td className="py-1.5">{s.suppressedUntilSimDay ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-[#0F1520]">
          <h2 className="text-[12px] font-bold text-white mb-3 tracking-wide">EVENT LOG (latest 40)</h2>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="font-normal pb-1">Time</th>
                <th className="font-normal pb-1">Type</th>
                <th className="font-normal pb-1">Attribute</th>
                <th className="font-normal pb-1">Category</th>
                <th className="font-normal pb-1">Surface</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-slate-800">
                  <td className="py-1 text-slate-500">{e.createdAt.toLocaleTimeString()}</td>
                  <td className="py-1 text-slate-200">{e.type}</td>
                  <td className="py-1 text-slate-400">{e.attribute ?? "—"}</td>
                  <td className="py-1 text-slate-400">{e.category ?? "—"}</td>
                  <td className="py-1 text-slate-400">{e.surface ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function FunnelStep({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-md px-2 py-3 text-center border ${highlight ? "border-rose-400/40 bg-rose-400/10" : "border-slate-800"}`}>
      <p className={`text-[18px] font-bold ${highlight ? "text-rose-400" : "text-white"}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function FunnelArrow() {
  return <div className="flex items-center text-slate-700 px-0.5">→</div>;
}

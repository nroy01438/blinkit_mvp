"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  switchPersonaAction,
  resetPersonaAction,
  fastForwardDayAction,
  fastForwardPackingAction,
} from "@/app/actions/demo";
import type { PersonaKey } from "@/lib/session";

const PERSONAS: { key: PersonaKey; label: string; emoji: string }[] = [
  { key: "priya", label: "Priya", emoji: "👩‍🍼" },
  { key: "rohit", label: "Rohit", emoji: "🐕" },
  { key: "ananya", label: "Ananya", emoji: "🏋️‍♀️" },
  { key: "vikram", label: "Vikram", emoji: "🧑‍💼" },
  { key: "guest", label: "Guest", emoji: "🙋" },
];

export function DemoPanel({ currentPersona, simDay }: { currentPersona: string; simDay: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="fixed bottom-16 md:bottom-4 right-3 z-[100]">
      {open && (
        <div className="mb-2 w-72 bg-[#1F1F1F] text-white rounded-xl shadow-2xl p-3 animate-fade-slide">
          <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2">Demo controls</p>

          <p className="text-[11px] text-white/60 mb-1">Switch persona</p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                disabled={pending}
                onClick={() => run(() => switchPersonaAction(p.key))}
                className={`text-[11px] rounded-md px-2 py-1.5 text-left ${
                  currentPersona === p.key ? "bg-action-green text-white" : "bg-white/10 hover:bg-white/15"
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/60">Sim day: {simDay}</span>
            <button
              disabled={pending}
              onClick={() => run(fastForwardDayAction)}
              className="text-[11px] bg-white/10 hover:bg-white/15 rounded-md px-2 py-1"
            >
              ⏩ +1 day
            </button>
          </div>

          <button
            disabled={pending}
            onClick={() => run(fastForwardPackingAction)}
            className="w-full text-[11px] bg-white/10 hover:bg-white/15 rounded-md px-2 py-1.5 mb-2 text-left"
          >
            ⏭ Fast-forward active order status
          </button>

          <button
            disabled={pending}
            onClick={() => run(() => resetPersonaAction(currentPersona as PersonaKey))}
            className="w-full text-[11px] bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-md px-2 py-1.5 mb-2 text-left"
          >
            ↺ Reset demo (this persona)
          </button>

          <a
            href="/internal"
            className="block text-center text-[11px] text-white/50 hover:text-white/80 pt-1 border-t border-white/10 mt-1"
          >
            Open instrumentation dashboard →
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-11 h-11 rounded-full bg-[#1F1F1F] text-white shadow-xl flex items-center justify-center text-lg"
        aria-label="Demo controls"
      >
        {open ? "✕" : "⚙️"}
      </button>
    </div>
  );
}

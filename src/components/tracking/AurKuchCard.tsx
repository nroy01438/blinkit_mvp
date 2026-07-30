"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSuggestedItem, declineSuggestion, answerAsk } from "@/app/actions/orders";
import type { AttributeKey, LeakCategoryKey } from "@/lib/attributes";

export interface AurKuchProduct {
  id: string;
  name: string;
  price: number;
  mrp: number;
  packSize: string;
  emoji: string;
  colorFrom: string;
  colorTo: string;
}

interface Props {
  orderId: string;
  tier: "ASSERT" | "ASK";
  attribute: AttributeKey;
  leakCategory: LeakCategoryKey;
  justification: string;
  question?: string;
  product?: AurKuchProduct;
}

type LocalState = "idle" | "added" | "declined" | "answered";

export function AurKuchCard({ orderId, tier, attribute, leakCategory, justification, question, product }: Props) {
  const [state, setState] = useState<LocalState>("idle");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (state === "added") {
    return (
      <SuggestionShell>
        <p className="text-[12.5px] text-action-green font-semibold">Added to your bag ✓</p>
      </SuggestionShell>
    );
  }
  if (state === "declined") {
    return (
      <SuggestionShell>
        <p className="text-[12.5px] text-text-muted">No worries — maybe next time.</p>
      </SuggestionShell>
    );
  }
  if (state === "answered") {
    return (
      <SuggestionShell>
        <p className="text-[12.5px] text-text-muted">Thanks, noted! 📝</p>
      </SuggestionShell>
    );
  }

  if (tier === "ASSERT" && product) {
    return (
      <SuggestionShell>
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-md flex items-center justify-center text-2xl shrink-0"
            style={{ background: `linear-gradient(160deg, ${product.colorFrom}, ${product.colorTo})` }}
          >
            {product.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-text-secondary leading-snug mb-1">{justification}</p>
            <p className="text-[13px] font-bold text-text-primary line-clamp-1">{product.name}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-text-primary">₹{product.price}</span>
              {product.mrp > product.price && <span className="text-[10px] text-text-muted line-through">₹{product.mrp}</span>}
              <span className="text-[10px] text-text-muted">· {product.packSize}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await addSuggestedItem(orderId, product.id);
                setState("added");
                router.refresh();
              })
            }
            className="flex-1 bg-action-green text-white text-[12.5px] font-bold rounded-md py-2"
          >
            Add to this bag
          </button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await declineSuggestion(orderId, leakCategory);
                setState("declined");
              })
            }
            className="text-[12.5px] text-text-muted font-semibold px-3 py-2"
          >
            Not now
          </button>
        </div>
      </SuggestionShell>
    );
  }

  return (
    <SuggestionShell>
      <p className="text-[13.5px] font-semibold text-text-primary leading-snug mb-3">{question}</p>
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await answerAsk(attribute, true, orderId);
              setState("answered");
              router.refresh();
            })
          }
          className="flex-1 bg-action-green text-white text-[12.5px] font-bold rounded-md py-2"
        >
          Haan (Yes)
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await answerAsk(attribute, false, orderId);
              setState("answered");
            })
          }
          className="flex-1 border border-divider text-text-secondary text-[12.5px] font-bold rounded-md py-2"
        >
          Nahi (No)
        </button>
      </div>
    </SuggestionShell>
  );
}

function SuggestionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-divider rounded-xl p-3.5 animate-fade-slide relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-action-green" />
      <p className="text-[12.5px] font-extrabold text-text-primary mb-2 pl-1">Aur kuch? 👀</p>
      <div className="pl-1">{children}</div>
    </div>
  );
}

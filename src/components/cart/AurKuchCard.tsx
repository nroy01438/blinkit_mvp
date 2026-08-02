"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSuggestedToCartAction, declineCartSuggestionAction, answerCartAskAction } from "@/app/actions/cartSuggestion";
import { useCart } from "@/components/CartContext";
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
  tier: "ASSERT" | "ASK";
  attribute: AttributeKey;
  leakCategory: LeakCategoryKey;
  justification: string;
  question?: string;
  product?: AurKuchProduct;
}

type LocalState = "idle" | "added" | "declined" | "answered";

/** The one moment "Aur kuch?" gets to make its case — on the cart page,
 * before "Proceed to Pay", while the customer can still act on it. Adding
 * merges the suggestion straight into the cart they're about to check out. */
export function AurKuchCard({ tier, attribute, leakCategory, justification, question, product }: Props) {
  const [state, setState] = useState<LocalState>("idle");
  const [confirmedProduct, setConfirmedProduct] = useState<AurKuchProduct | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { getQty, updateQty } = useCart();

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

  // Once an ASK question is answered "yes", the graph is upgraded to
  // ASSERT server-side and the resolved product comes back in the same
  // round trip — show it immediately instead of waiting for the next order.
  const effectiveProduct = confirmedProduct ?? product;
  const effectiveTier = confirmedProduct ? "ASSERT" : tier;

  if (effectiveTier === "ASSERT" && effectiveProduct) {
    return (
      <SuggestionShell>
        {confirmedProduct && (
          <p className="text-[11.5px] text-action-green font-semibold mb-2">Got it — here&apos;s something for that 👇</p>
        )}
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-md flex items-center justify-center text-2xl shrink-0"
            style={{ background: `linear-gradient(160deg, ${effectiveProduct.colorFrom}, ${effectiveProduct.colorTo})` }}
          >
            {effectiveProduct.emoji}
          </div>
          <div className="flex-1 min-w-0">
            {!confirmedProduct && <p className="text-[12.5px] text-text-secondary leading-snug mb-1">{justification}</p>}
            <p className="text-[13px] font-bold text-text-primary line-clamp-1">{effectiveProduct.name}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-text-primary">₹{effectiveProduct.price}</span>
              {effectiveProduct.mrp > effectiveProduct.price && (
                <span className="text-[10px] text-text-muted line-through">₹{effectiveProduct.mrp}</span>
              )}
              <span className="text-[10px] text-text-muted">· {effectiveProduct.packSize}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await addSuggestedToCartAction(effectiveProduct.id, attribute);
                updateQty(effectiveProduct.id, getQty(effectiveProduct.id) + 1, effectiveProduct.price);
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
                await declineCartSuggestionAction(leakCategory);
                setState("declined");
                router.refresh();
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
              const resolved = await answerCartAskAction(attribute, true);
              if (resolved) {
                setConfirmedProduct({
                  id: resolved.id,
                  name: resolved.name,
                  price: resolved.price,
                  mrp: resolved.mrp,
                  packSize: resolved.packSize,
                  emoji: resolved.emoji,
                  colorFrom: resolved.colorFrom,
                  colorTo: resolved.colorTo,
                });
              } else {
                setState("answered");
              }
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
              await answerCartAskAction(attribute, false);
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
    <div className="bg-surface border border-divider rounded-xl p-3.5 mb-3 animate-fade-slide relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-action-green" />
      <p className="text-[12.5px] font-extrabold text-text-primary mb-2 pl-1">Aur kuch? 👀</p>
      <div className="pl-1">{children}</div>
    </div>
  );
}

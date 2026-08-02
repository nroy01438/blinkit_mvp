"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSuggestedToCartAction, declineCartSuggestionAction } from "@/app/actions/cartSuggestion";
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
  attribute: AttributeKey;
  leakCategory: LeakCategoryKey;
  justification: string;
  product: AurKuchProduct;
}

type LocalState = "idle" | "added" | "declined";

/** The one moment "Aur kuch?" gets to make its case — on the cart page,
 * before "Proceed to Pay", while the customer can still act on it. Adding
 * merges the suggestion straight into the cart they're about to check out. */
export function AurKuchCard({ attribute, leakCategory, justification, product }: Props) {
  const [state, setState] = useState<LocalState>("idle");
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
              await addSuggestedToCartAction(product.id, attribute);
              updateQty(product.id, getQty(product.id) + 1, product.price);
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

function SuggestionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-divider rounded-xl p-3.5 mb-3 animate-fade-slide relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-action-green" />
      <p className="text-[12.5px] font-extrabold text-text-primary mb-2 pl-1">Aur kuch? 👀</p>
      <div className="pl-1">{children}</div>
    </div>
  );
}

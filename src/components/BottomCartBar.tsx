"use client";

import Link from "next/link";
import { useCart } from "@/components/CartContext";

export function BottomCartBar() {
  const { count, itemTotal } = useCart();
  if (count === 0) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-2">
      <Link
        href="/cart"
        className="flex items-center justify-between bg-action-green text-white rounded-lg px-3 py-2.5 shadow-lg animate-fade-slide"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-white/15 flex items-center justify-center text-xs font-bold">{count}</div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold">
              {count} item{count > 1 ? "s" : ""} · ₹{itemTotal}
            </div>
            <div className="text-[10px] opacity-80">Extra charges may apply</div>
          </div>
        </div>
        <div className="text-[13px] font-bold flex items-center gap-1">
          View Cart <span>›</span>
        </div>
      </Link>
    </div>
  );
}

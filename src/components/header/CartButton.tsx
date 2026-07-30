"use client";

import Link from "next/link";
import { useCart } from "@/components/CartContext";

export function CartButton() {
  const { count, itemTotal } = useCart();
  return (
    <Link
      href="/cart"
      className="flex items-center gap-2 bg-action-green text-white rounded-lg px-3 h-11 font-bold text-[13px] whitespace-nowrap"
    >
      <CartIcon />
      {count > 0 ? (
        <span>
          {count} item{count > 1 ? "s" : ""} · ₹{itemTotal}
        </span>
      ) : (
        <span>My Cart</span>
      )}
    </Link>
  );
}

function CartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M6 6h15l-1.5 9h-12z" strokeLinejoin="round" />
      <path d="M6 6L4.5 3H2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}

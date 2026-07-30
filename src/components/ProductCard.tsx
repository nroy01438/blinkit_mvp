"use client";

import { useCart } from "@/components/CartContext";

export interface ProductCardData {
  id: string;
  name: string;
  brand: string;
  price: number;
  mrp: number;
  packSize: string;
  deliveryMins: number;
  emoji: string;
  colorFrom: string;
  colorTo: string;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { getQty, updateQty } = useCart();
  const qty = getQty(product.id);
  const discountPct = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <div className="flex flex-col rounded-lg border border-divider bg-surface p-2 h-full">
      <div
        className="relative aspect-square w-full rounded-md flex items-center justify-center text-4xl mb-2 overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${product.colorFrom}, ${product.colorTo})` }}
      >
        {discountPct >= 5 && (
          <span className="absolute top-0 left-0 bg-ribbon-blue text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-md rounded-tl-md leading-tight">
            {discountPct}% OFF
          </span>
        )}
        <span aria-hidden>{product.emoji}</span>
      </div>

      <div className="flex items-center gap-1 text-text-muted mb-0.5">
        <ClockIcon />
        <span className="text-[10px] font-semibold tracking-wide text-text-secondary">{product.deliveryMins} MINS</span>
      </div>

      <p className="text-[13px] leading-[16px] text-text-primary line-clamp-2 min-h-[32px] mb-0.5">{product.name}</p>
      <p className="text-[11px] text-text-muted mb-2">{product.packSize}</p>

      <div className="mt-auto flex items-end justify-between gap-1">
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-bold text-text-primary">₹{product.price}</span>
          {product.mrp > product.price && (
            <span className="text-[10px] text-text-muted line-through">₹{product.mrp}</span>
          )}
        </div>

        {qty === 0 ? (
          <button
            onClick={() => updateQty(product.id, 1, product.price)}
            className="text-[11px] font-bold uppercase text-action-green border border-action-green rounded-md px-3 py-1.5 bg-surface active:bg-green-tint tracking-wide"
          >
            Add
          </button>
        ) : (
          <div className="flex items-center gap-0 bg-action-green rounded-md text-white overflow-hidden h-[26px]">
            <button
              aria-label="Decrease quantity"
              onClick={() => updateQty(product.id, qty - 1, product.price)}
              className="w-6 h-full flex items-center justify-center text-sm font-bold active:bg-action-green-dark"
            >
              −
            </button>
            <span className="w-5 text-center text-[12px] font-bold">{qty}</span>
            <button
              aria-label="Increase quantity"
              onClick={() => updateQty(product.id, qty + 1, product.price)}
              className="w-6 h-full flex items-center justify-center text-sm font-bold active:bg-action-green-dark"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-muted">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

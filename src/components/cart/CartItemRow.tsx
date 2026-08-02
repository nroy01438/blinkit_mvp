"use client";

import { useCart } from "@/components/CartContext";

export interface CartRowData {
  id: string;
  name: string;
  packSize: string;
  price: number;
  mrp: number;
  emoji: string;
  colorFrom: string;
  colorTo: string;
  isAddOn?: boolean;
}

export function CartItemRow({ product }: { product: CartRowData }) {
  const { getQty, updateQty } = useCart();
  const qty = getQty(product.id);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-divider last:border-b-0">
      <div
        className="w-12 h-12 rounded-md flex items-center justify-center text-xl shrink-0"
        style={{ background: `linear-gradient(160deg, ${product.colorFrom}, ${product.colorTo})` }}
      >
        {product.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-text-primary line-clamp-2 leading-tight">
          {product.name}
          {product.isAddOn && <span className="text-action-green font-semibold"> · aur kuch</span>}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">{product.packSize}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[12px] font-bold text-text-primary">₹{product.price}</span>
          {product.mrp > product.price && (
            <span className="text-[10px] text-text-muted line-through">₹{product.mrp}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0 bg-action-green rounded-md text-white overflow-hidden h-7 shrink-0">
        <button
          aria-label="Decrease quantity"
          onClick={() => updateQty(product.id, qty - 1, product.price)}
          className="w-7 h-full flex items-center justify-center text-sm font-bold active:bg-action-green-dark"
        >
          −
        </button>
        <span className="w-6 text-center text-[12px] font-bold">{qty}</span>
        <button
          aria-label="Increase quantity"
          onClick={() => updateQty(product.id, qty + 1, product.price)}
          className="w-7 h-full flex items-center justify-center text-sm font-bold active:bg-action-green-dark"
        >
          +
        </button>
      </div>
    </div>
  );
}

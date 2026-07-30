"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { setCartQty } from "@/lib/cart";

interface CartState {
  qtyMap: Record<string, number>;
  count: number;
  itemTotal: number;
}

interface CartContextValue extends CartState {
  getQty: (productId: string) => number;
  updateQty: (productId: string, qty: number, priceForOptimism: number) => void;
  clearAll: () => void;
  pending: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  initialQtyMap,
  initialCount,
  initialItemTotal,
  children,
}: {
  initialQtyMap: Record<string, number>;
  initialCount: number;
  initialItemTotal: number;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CartState>({
    qtyMap: initialQtyMap,
    count: initialCount,
    itemTotal: initialItemTotal,
  });
  const [pending, startTransition] = useTransition();

  const updateQty = useCallback((productId: string, qty: number, price: number) => {
    setState((prev) => {
      const prevQty = prev.qtyMap[productId] ?? 0;
      const delta = qty - prevQty;
      const nextMap = { ...prev.qtyMap };
      if (qty <= 0) delete nextMap[productId];
      else nextMap[productId] = qty;
      return {
        qtyMap: nextMap,
        count: prev.count + delta,
        itemTotal: prev.itemTotal + delta * price,
      };
    });
    startTransition(() => {
      setCartQty(productId, qty).catch(() => {
        // graceful failure: leave optimistic state as-is for the demo
      });
    });
  }, []);

  const getQty = useCallback((productId: string) => state.qtyMap[productId] ?? 0, [state.qtyMap]);

  const clearAll = useCallback(() => {
    setState({ qtyMap: {}, count: 0, itemTotal: 0 });
  }, []);

  const value = useMemo(
    () => ({ ...state, getQty, updateQty, clearAll, pending }),
    [state, getQty, updateQty, clearAll, pending]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeOrder } from "@/app/actions/orders";
import { useCart } from "@/components/CartContext";

const TIP_OPTIONS = [0, 20, 30, 50];

export function CartCheckoutBar({ grandTotalWithoutTip }: { grandTotalWithoutTip: number }) {
  const [tip, setTip] = useState(20);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { clearAll } = useCart();

  function handlePlaceOrder() {
    startTransition(async () => {
      const orderId = await placeOrder(tip);
      clearAll();
      router.push(`/orders/${orderId}`);
    });
  }

  return (
    <div className="border-t border-divider bg-surface p-3">
      <div className="mb-3">
        <p className="text-[12px] font-bold text-text-primary mb-1.5">Tip your delivery partner</p>
        <div className="flex gap-2">
          {TIP_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTip(t)}
              className={`flex-1 text-[12px] font-bold rounded-md py-1.5 border ${
                tip === t ? "border-action-green bg-green-tint text-action-green" : "border-divider text-text-secondary"
              }`}
            >
              {t === 0 ? "No tip" : `₹${t}`}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={handlePlaceOrder}
        disabled={pending}
        className="w-full bg-action-green text-white font-bold text-[14px] rounded-lg py-3 disabled:opacity-60"
      >
        {pending ? "Placing order…" : `Proceed to Pay ₹${grandTotalWithoutTip + tip}`}
      </button>
    </div>
  );
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { computeStatus, ensureDeliveredLogged, remainingSecondsInPhase, type OrderStatus } from "@/lib/orderStatus";
import { getOrderSuggestionDisplay, orderHasSuggestionResponse } from "@/lib/suggestion";
import { OrderStepper } from "@/components/tracking/OrderStepper";
import { AutoRefresh } from "@/components/tracking/AutoRefresh";
import { AurKuchCard } from "@/components/tracking/AurKuchCard";
import { RatingForm } from "@/components/tracking/RatingForm";

const STATUS_HEADLINE: Record<OrderStatus, string> = {
  PLACED: "Order placed!",
  PACKING: "Packing your order",
  OUT_FOR_DELIVERY: "On its way to you",
  DELIVERED: "Delivered",
};

const STATUS_EMOJI: Record<OrderStatus, string> = {
  PLACED: "🧾",
  PACKING: "📦",
  OUT_FOR_DELIVERY: "🛵",
  DELIVERED: "✅",
};

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = await getOrCreateSessionPersona();

  const order = await db.order.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
  if (!order || order.sessionPersonaId !== sp.id) notFound();

  const status = computeStatus(order);
  await ensureDeliveredLogged(order.id);

  const showSuggestionSurface = order.suggestionSurfaceShown === "TRACKING" && (status === "PACKING" || status === "OUT_FOR_DELIVERY");
  const alreadyResponded = showSuggestionSurface ? await orderHasSuggestionResponse(order.id) : true;
  const suggestion = showSuggestionSurface && !alreadyResponded ? await getOrderSuggestionDisplay(order, sp.id) : null;
  const suggestionButAnswered = showSuggestionSurface && alreadyResponded ? await getOrderSuggestionDisplay(order, sp.id) : null;

  const addOnItem = order.items.find((i) => i.isAddOn);
  const showRating = status === "DELIVERED" && order.ratingStars === null && !order.isSeedHistory;

  const remainingSecs = remainingSecondsInPhase(order, status);

  return (
    <div className="max-w-[640px] mx-auto px-4 py-5">
      {status !== "DELIVERED" && <AutoRefresh intervalMs={2500} />}

      <div className="bg-surface border border-divider rounded-xl p-5 mb-4 text-center">
        <div className="text-5xl mb-2">{STATUS_EMOJI[status]}</div>
        <h1 className="text-[20px] font-extrabold text-text-primary mb-1">{STATUS_HEADLINE[status]}</h1>
        {status !== "DELIVERED" ? (
          <p className="text-[13px] text-text-secondary">
            Arriving in <span className="font-bold text-text-primary">{Math.max(2, Math.ceil(remainingSecs / 30))} mins</span>
          </p>
        ) : (
          <p className="text-[13px] text-text-secondary">Delivered — enjoy! 🎉</p>
        )}
      </div>

      <div className="bg-surface border border-divider rounded-xl p-4 mb-4">
        <OrderStepper status={status} />
      </div>

      {suggestion && (
        <div className="mb-4">
          {suggestion.tier === "ASSERT" ? (
            <AurKuchCard
              orderId={order.id}
              tier="ASSERT"
              attribute={suggestion.attribute}
              leakCategory={suggestion.leakCategory}
              justification={suggestion.justification}
              product={{
                id: suggestion.product.id,
                name: suggestion.product.name,
                price: suggestion.product.price,
                mrp: suggestion.product.mrp,
                packSize: suggestion.product.packSize,
                emoji: suggestion.product.emoji,
                colorFrom: suggestion.product.colorFrom,
                colorTo: suggestion.product.colorTo,
              }}
            />
          ) : (
            <AurKuchCard
              orderId={order.id}
              tier="ASK"
              attribute={suggestion.attribute}
              leakCategory={suggestion.leakCategory}
              justification={suggestion.justification}
              question={suggestion.question}
            />
          )}
        </div>
      )}

      {!suggestion && suggestionButAnswered && (
        <div className="mb-4 text-center text-[11.5px] text-text-muted">Aur kuch suggestion already handled for this order ✓</div>
      )}

      <div className="bg-surface border border-divider rounded-xl p-4 mb-4">
        <p className="text-[12px] font-bold text-text-primary mb-2">Order summary</p>
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between text-[12.5px] py-1">
            <span className="text-text-secondary">
              {i.qty} × {i.product.name}
              {i.isAddOn && <span className="text-action-green font-semibold"> · aur kuch</span>}
            </span>
            <span className="text-text-primary font-semibold">₹{i.priceAtPurchase * i.qty}</span>
          </div>
        ))}
        <div className="border-t border-divider mt-2 pt-2 flex items-center justify-between text-[13px] font-bold text-text-primary">
          <span>Grand total</span>
          <span>₹{order.grandTotal}</span>
        </div>
      </div>

      {showRating && (
        <RatingForm
          orderId={order.id}
          followUpQuestion={addOnItem ? `Did the ${addOnItem.product.name} work out for you?` : undefined}
        />
      )}
    </div>
  );
}

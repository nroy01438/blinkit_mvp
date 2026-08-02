import Link from "next/link";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { computeTotals } from "@/lib/pricing";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CartCheckoutBar } from "@/components/cart/CartCheckoutBar";
import { AurKuchCard } from "@/components/cart/AurKuchCard";
import { chooseSuggestion, ensureCartSuggestionShownLogged, leakCategoryOf } from "@/lib/suggestion";
import type { LeakCategoryKey } from "@/lib/attributes";

/** The cart panel's actual content — shared between the full-page /cart
 * route (direct navigation, no JS, mobile) and the intercepted @modal
 * drawer (client-side navigation from within the app, desktop). */
export async function CartContent() {
  const sp = await getOrCreateSessionPersona();
  const cartItems = await db.cartItem.findMany({
    where: { sessionPersonaId: sp.id },
    include: { product: true },
    orderBy: { id: "asc" },
  });

  const totals = computeTotals(cartItems.map((i) => ({ price: i.product.price, qty: i.qty })));

  const cartLeakCategories = new Set(
    cartItems.map((i) => leakCategoryOf(i.product.category, i.product.subcategory)).filter((c): c is LeakCategoryKey => c !== null)
  );
  // One suggestion opportunity per checkout: once the customer has acted on
  // it (added / not now / answered), stay quiet for the rest of this cart,
  // even if a different attribute would otherwise also qualify.
  const suggestion =
    cartItems.length > 0 && !sp.cartSuggestionSpent ? await chooseSuggestion(sp.id, cartLeakCategories) : null;
  if (suggestion) {
    await ensureCartSuggestionShownLogged(sp.id, sp.cartSuggestionShown, suggestion);
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-divider">
        <h1 className="text-[15px] font-extrabold text-text-primary">Delivery in 8 minutes</h1>
        <p className="text-[11px] text-text-muted">Shipment of {cartItems.length} item(s)</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
          <span className="text-4xl mb-3">🛒</span>
          <p className="text-[14px] font-bold text-text-primary mb-1">Your cart is empty</p>
          <p className="text-[12px] text-text-muted mb-4">Add items to get started</p>
          <Link href="/" className="text-[13px] font-bold text-action-green">
            Browse products →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4">
            {cartItems.map((i) => (
              <CartItemRow
                key={i.id}
                product={{
                  id: i.productId,
                  name: i.product.name,
                  packSize: i.product.packSize,
                  price: i.product.price,
                  mrp: i.product.mrp,
                  emoji: i.product.emoji,
                  colorFrom: i.product.colorFrom,
                  colorTo: i.product.colorTo,
                  isAddOn: i.isAddOn,
                }}
              />
            ))}

            <div className="py-3">
              <p className="text-[12px] font-bold text-text-primary mb-2">Bill details</p>
              <BillRow label="Item total" value={totals.itemTotal} />
              <BillRow label="Delivery fee" value={totals.deliveryFee} free={totals.deliveryFee === 0} />
              <BillRow label="Handling charge" value={totals.handlingFee} />
              <div className="border-t border-divider mt-2 pt-2">
                <BillRow label="Grand total" value={totals.grandTotal} bold />
              </div>
            </div>

            {suggestion &&
              (suggestion.tier === "ASSERT" && suggestion.productId ? (
                <AurKuchCard
                  tier="ASSERT"
                  attribute={suggestion.attribute}
                  leakCategory={suggestion.leakCategory}
                  justification={suggestion.justification}
                  product={{
                    id: suggestion.productId,
                    name: suggestion.productName!,
                    price: suggestion.productPrice!,
                    mrp: suggestion.productMrp!,
                    packSize: suggestion.productPackSize!,
                    emoji: suggestion.productEmoji!,
                    colorFrom: suggestion.productColorFrom!,
                    colorTo: suggestion.productColorTo!,
                  }}
                />
              ) : (
                <AurKuchCard
                  tier="ASK"
                  attribute={suggestion.attribute}
                  leakCategory={suggestion.leakCategory}
                  justification={suggestion.justification}
                  question={suggestion.question}
                />
              ))}
          </div>

          <CartCheckoutBar grandTotalWithoutTip={totals.grandTotal} />
        </>
      )}
    </>
  );
}

function BillRow({ label, value, free, bold }: { label: string; value: number; free?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 text-[12.5px] ${bold ? "font-bold text-text-primary" : "text-text-secondary"}`}>
      <span>{label}</span>
      <span>{free ? "FREE" : `₹${value}`}</span>
    </div>
  );
}

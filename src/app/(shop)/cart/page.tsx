import { CartContent } from "@/components/cart/CartContent";

/** Direct-navigation fallback (typed URL, page refresh, no-JS, or mobile
 * where the cart is meant to be full-screen anyway). Client-side navigation
 * from within the app on desktop is intercepted by @modal/(.)cart instead,
 * which overlays this same content as a drawer on top of the still-visible
 * page underneath — see src/app/(shop)/layout.tsx. */
export default function CartPage() {
  return (
    <div className="md:bg-black/10 md:min-h-[calc(100vh-72px)]">
      <div className="md:max-w-[420px] md:ml-auto bg-surface md:shadow-2xl md:min-h-[calc(100vh-72px)] flex flex-col">
        <CartContent />
      </div>
    </div>
  );
}

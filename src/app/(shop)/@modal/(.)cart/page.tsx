import { CartContent } from "@/components/cart/CartContent";
import { CartModalShell } from "@/components/cart/CartModalShell";

/** Intercepts client-side navigation to /cart (Link clicks from within the
 * app) and renders it as a drawer over the page you came from, instead of
 * swapping the whole route and leaving a blank backdrop. Typing /cart
 * directly, refreshing, or opening it in a new tab bypasses this and hits
 * the plain full-page route at src/app/(shop)/cart/page.tsx instead. */
export default function CartModal() {
  return (
    <CartModalShell>
      <CartContent />
    </CartModalShell>
  );
}

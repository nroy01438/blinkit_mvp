import { Suspense } from "react";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { PERSONA_TEMPLATES } from "@/data/seed";
import { CartProvider } from "@/components/CartContext";
import { DesktopHeader } from "@/components/header/DesktopHeader";
import { MobileHeader } from "@/components/header/MobileHeader";
import { BottomCartBar } from "@/components/BottomCartBar";
import { Footer } from "@/components/Footer";
import { DemoPanel } from "@/components/demo/DemoPanel";
import { ShellSkeleton } from "@/components/ShellSkeleton";
import { computeTotals } from "@/lib/pricing";

export default function ShopLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <SessionShell modal={modal}>{children}</SessionShell>
    </Suspense>
  );
}

async function SessionShell({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const sp = await getOrCreateSessionPersona();
  const template = PERSONA_TEMPLATES.find((t) => t.key === sp.personaKey);
  const cartItems = await db.cartItem.findMany({ where: { sessionPersonaId: sp.id }, include: { product: true } });
  const qtyMap: Record<string, number> = {};
  for (const i of cartItems) qtyMap[i.productId] = i.qty;
  const totals = computeTotals(cartItems.map((i) => ({ price: i.product.price, qty: i.qty })));
  const count = cartItems.reduce((s, i) => s + i.qty, 0);

  return (
    <CartProvider initialQtyMap={qtyMap} initialCount={count} initialItemTotal={totals.itemTotal}>
      <DesktopHeader city={template?.city ?? "Gurgaon"} personaName={template?.name ?? "Guest"} />
      <MobileHeader city={template?.city ?? "Gurgaon"} />
      <div className="flex-1">{children}</div>
      <Footer />
      <BottomCartBar />
      <DemoPanel currentPersona={sp.personaKey} simDay={sp.simDay} />
      {modal}
    </CartProvider>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { computeStatus } from "@/lib/orderStatus";

export default async function OrderHistoryPage() {
  const sp = await getOrCreateSessionPersona();
  const orders = await db.order.findMany({
    where: { sessionPersonaId: sp.id },
    include: { items: { include: { product: true } } },
    orderBy: { placedAt: "desc" },
  });

  return (
    <div className="max-w-[720px] mx-auto px-4 py-5">
      <h1 className="text-[18px] font-extrabold text-text-primary mb-4">Your orders</h1>
      {orders.length === 0 && <p className="text-[13px] text-text-muted">No orders yet.</p>}
      <div className="flex flex-col gap-3">
        {orders.map((order) => {
          const status = computeStatus(order);
          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="border border-divider rounded-xl p-3.5 bg-surface flex items-center gap-3"
            >
              <div className="flex -space-x-2 shrink-0">
                {order.items.slice(0, 3).map((i) => (
                  <div
                    key={i.id}
                    className="w-10 h-10 rounded-md flex items-center justify-center text-lg border-2 border-surface"
                    style={{ background: `linear-gradient(160deg, ${i.product.colorFrom}, ${i.product.colorTo})` }}
                  >
                    {i.product.emoji}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-text-primary line-clamp-1">
                  {order.items.map((i) => i.product.name).join(", ")}
                </p>
                <p className="text-[11px] text-text-muted">
                  {order.placedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {order.items.length} item(s)
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold text-text-primary">₹{order.grandTotal}</p>
                <p className={`text-[10.5px] font-semibold ${status === "DELIVERED" ? "text-action-green" : "text-ribbon-blue"}`}>
                  {status === "DELIVERED" ? "Delivered" : status.replace(/_/g, " ")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

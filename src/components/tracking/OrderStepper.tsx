import type { OrderStatus } from "@/lib/orderStatus";

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "PLACED", label: "Order placed" },
  { key: "PACKING", label: "Being packed" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

const ORDER = ["PLACED", "PACKING", "OUT_FOR_DELIVERY", "DELIVERED"];

export function OrderStepper({ status }: { status: OrderStatus }) {
  const currentIdx = ORDER.indexOf(status);
  return (
    <div className="px-1">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const isLast = idx === STEPS.length - 1;
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  isDone || isActive ? "bg-action-green text-white" : "bg-page-bg text-text-muted border border-divider"
                }`}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              {!isLast && <div className={`w-[2px] flex-1 min-h-[28px] ${isDone ? "bg-action-green" : "bg-divider"}`} />}
            </div>
            <div className={`pb-6 ${isActive ? "" : ""}`}>
              <p className={`text-[13.5px] leading-6 ${isActive ? "font-extrabold text-text-primary" : isDone ? "font-semibold text-text-primary" : "text-text-muted"}`}>
                {step.label}
              </p>
              {isActive && step.key === "PACKING" && (
                <p className="text-[11.5px] text-text-muted">Your rider will pick it up shortly</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

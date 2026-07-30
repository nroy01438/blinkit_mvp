export const HANDLING_FEE = 19;
export const FREE_DELIVERY_THRESHOLD = 99;
export const DELIVERY_FEE = 25;

export function computeTotals(items: { price: number; qty: number }[]) {
  const itemTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryFee = itemTotal >= FREE_DELIVERY_THRESHOLD || itemTotal === 0 ? 0 : DELIVERY_FEE;
  const handlingFee = itemTotal === 0 ? 0 : HANDLING_FEE;
  const grandTotal = itemTotal + deliveryFee + handlingFee;
  return { itemTotal, deliveryFee, handlingFee, grandTotal };
}

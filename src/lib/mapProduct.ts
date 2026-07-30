import type { ProductCardData } from "@/components/ProductCard";

interface DbProductLike {
  id: string;
  name: string;
  brand: string;
  price: number;
  mrp: number;
  packSize: string;
  deliveryMins: number;
  emoji: string;
  colorFrom: string;
  colorTo: string;
}

export function toCardData(p: DbProductLike): ProductCardData {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    mrp: p.mrp,
    packSize: p.packSize,
    deliveryMins: p.deliveryMins,
    emoji: p.emoji,
    colorFrom: p.colorFrom,
    colorTo: p.colorTo,
  };
}

import Link from "next/link";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";

export function ProductRail({
  title,
  seeAllHref,
  products,
}: {
  title: string;
  seeAllHref?: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="max-w-[1280px] mx-auto px-3 md:px-6 py-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] md:text-[17px] font-extrabold text-text-primary">{title}</h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-[12px] font-bold text-action-green">
            see all
          </Link>
        )}
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {products.map((p) => (
          <div key={p.id} className="w-[132px] md:w-[160px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

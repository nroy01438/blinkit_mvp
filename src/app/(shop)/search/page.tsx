import Link from "next/link";
import { db } from "@/lib/db";
import { toCardData } from "@/lib/mapProduct";
import { ProductCard } from "@/components/ProductCard";

const RECENT_SEARCHES = ["milk", "atta", "chips", "cerelac", "detergent", "juice"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const products = query
    ? await db.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { brand: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { subcategory: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 60,
      })
    : [];

  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-4">
      {!query ? (
        <div>
          <h1 className="text-[14px] font-bold text-text-primary mb-2.5">Recent searches</h1>
          <div className="flex flex-wrap gap-2">
            {RECENT_SEARCHES.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="text-[12px] text-text-secondary bg-page-bg border border-divider rounded-full px-3 py-1.5"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-text-muted mb-3">
            {products.length} results for &ldquo;{query}&rdquo;
          </p>
          {products.length === 0 ? (
            <p className="text-[13px] text-text-muted py-10 text-center">No products found. Try another search.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={toCardData(p)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

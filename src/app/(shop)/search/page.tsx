import Link from "next/link";
import { db } from "@/lib/db";
import { toCardData } from "@/lib/mapProduct";
import { ProductCard } from "@/components/ProductCard";

const RECENT_SEARCHES = ["milk", "atta", "chips", "cerelac", "detergent", "juice"];

/** Lowercases, strips apostrophes so "Lay's" reads as "lays", and turns any
 * other punctuation/hyphen into a word boundary so "Coca-Cola" reads as two
 * separate words — matching how people actually type a product name. */
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const queryWords = normalizeText(query).split(" ").filter(Boolean);

  // A real query is almost always more than one word ("coca cola", "amul
  // milk", "lays chips") — matching the whole query as one literal
  // substring against a single field misses nearly all of them, since
  // catalog names rarely contain the query verbatim. Instead every query
  // word must appear _somewhere_ across the product's name/brand/category/
  // subcategory, each independently. The catalog is small (~384 SKUs), so
  // filtering in code beats fighting Postgres's LIKE semantics over
  // punctuation/hyphens for a result set this size.
  const products =
    queryWords.length > 0
      ? (await db.product.findMany())
          .filter((p) => {
            const haystack = normalizeText(`${p.name} ${p.brand} ${p.category} ${p.subcategory}`);
            return queryWords.every((w) => haystack.includes(w));
          })
          .slice(0, 60)
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

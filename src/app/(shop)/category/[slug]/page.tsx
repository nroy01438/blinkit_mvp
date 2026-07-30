import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryBySlug } from "@/lib/categories";
import { toCardData } from "@/lib/mapProduct";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { slug } = await params;
  const { sub } = await searchParams;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const products = await db.product.findMany({
    where: { category: category.name, ...(sub ? { subcategory: sub } : {}) },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-[1280px] mx-auto flex">
      <CategorySidebar activeSlug={slug} activeSub={sub} />
      <div className="flex-1 min-w-0 px-3 md:px-6 py-4">
        <h1 className="text-[16px] md:text-[20px] font-extrabold text-text-primary mb-1">
          {sub ?? category.name}
        </h1>
        <p className="text-[12px] text-text-muted mb-3">{products.length} items</p>
        {products.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">No products in this section yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={toCardData(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

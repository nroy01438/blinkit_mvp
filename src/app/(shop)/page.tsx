import { db } from "@/lib/db";
import { getOrCreateSessionPersona } from "@/lib/session";
import { toCardData } from "@/lib/mapProduct";
import { CategoryStrip } from "@/components/CategoryStrip";
import { PromoBanner } from "@/components/PromoBanner";
import { ProductRail } from "@/components/ProductRail";
import { slugForCategoryName } from "@/lib/categories";

const SECTIONS: { title: string; categories: string[] }[] = [
  { title: "Grocery & Kitchen", categories: ["Fruits & Vegetables", "Dairy, Bread & Eggs"] },
  { title: "Snacks & Drinks", categories: ["Snacks & Munchies", "Cold Drinks & Juices"] },
  { title: "Beauty & Personal Care", categories: ["Personal Care"] },
  { title: "Household Essentials", categories: ["Household Essentials", "Home & Party"] },
];

export default async function Home() {
  const sp = await getOrCreateSessionPersona();

  const [buyAgainItems, sectionProducts] = await Promise.all([
    db.orderItem.groupBy({
      by: ["productId"],
      where: { order: { sessionPersonaId: sp.id } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 10,
    }),
    Promise.all(
      SECTIONS.map((s) =>
        db.product.findMany({ where: { category: { in: s.categories } }, take: 12 })
      )
    ),
  ]);

  const buyAgainProductIds = buyAgainItems.map((i) => i.productId);
  const buyAgainProducts = buyAgainProductIds.length
    ? await db.product.findMany({ where: { id: { in: buyAgainProductIds } } })
    : [];
  const buyAgainOrdered = buyAgainProductIds
    .map((id) => buyAgainProducts.find((p) => p.id === id))
    .filter((p): p is (typeof buyAgainProducts)[number] => !!p);

  return (
    <div className="pb-4">
      <CategoryStrip />
      <PromoBanner />
      <ProductRail title="Buy it again" products={buyAgainOrdered.map(toCardData)} />
      {SECTIONS.map((s, idx) => (
        <ProductRail
          key={s.title}
          title={s.title}
          seeAllHref={`/category/${slugForCategoryName(s.categories[0])}`}
          products={sectionProducts[idx].map(toCardData)}
        />
      ))}
    </div>
  );
}

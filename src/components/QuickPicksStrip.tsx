import Link from "next/link";
import { slugForCategoryName } from "@/lib/categories";

export interface QuickPickItem {
  id: string;
  name: string;
  category: string;
  emoji: string;
  colorFrom: string;
  colorTo: string;
}

/** The row of small square item thumbnails Blinkit shows just under its
 * promo cards — trending picks across categories, image-first with no
 * price. Each tile links into that item's category since this prototype
 * has no standalone product page. */
export function QuickPicksStrip({ items }: { items: QuickPickItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-3">
      <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/category/${slugForCategoryName(item.category)}`}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[76px] md:w-[92px]"
          >
            <div
              className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-xl flex items-center justify-center text-3xl md:text-4xl"
              style={{ background: `linear-gradient(160deg, ${item.colorFrom}, ${item.colorTo})` }}
            >
              {item.emoji}
            </div>
            <span className="text-[10.5px] md:text-[11.5px] text-text-primary text-center leading-tight line-clamp-2">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

export function CategorySidebar({ activeSlug, activeSub }: { activeSlug: string; activeSub?: string }) {
  const active = CATEGORIES.find((c) => c.slug === activeSlug);

  return (
    <aside className="w-[88px] md:w-[220px] shrink-0 border-r border-divider bg-surface">
      <div className="py-2">
        {CATEGORIES.map((c) => {
          const isActive = c.slug === activeSlug;
          return (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className={`flex md:flex-row flex-col items-center gap-1 md:gap-2 px-2 md:px-3 py-2.5 border-l-[3px] ${
                isActive ? "border-action-green bg-green-tint/60" : "border-transparent"
              }`}
            >
              <span className="text-xl md:text-lg shrink-0">{c.emoji}</span>
              <span
                className={`text-[9.5px] md:text-[12.5px] text-center md:text-left leading-tight line-clamp-2 ${
                  isActive ? "text-action-green font-bold" : "text-text-secondary"
                }`}
              >
                {c.name}
              </span>
            </Link>
          );
        })}
      </div>
      {active && (
        <div className="hidden md:block border-t border-divider py-2">
          {active.subcategories.map((sub) => (
            <Link
              key={sub}
              href={`/category/${activeSlug}?sub=${encodeURIComponent(sub)}`}
              className={`block px-4 py-1.5 text-[12px] ${
                activeSub === sub ? "text-action-green font-bold" : "text-text-secondary"
              }`}
            >
              {sub}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}

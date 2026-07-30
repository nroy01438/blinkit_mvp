import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

export function CategoryStrip() {
  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-3">
      <div className="flex gap-3 md:gap-5 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className="flex flex-col items-center gap-1.5 shrink-0 w-16 md:w-20"
          >
            <div
              className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center text-2xl md:text-3xl"
              style={{ background: c.color }}
            >
              {c.emoji}
            </div>
            <span className="text-[10px] md:text-[11px] text-text-primary text-center leading-tight line-clamp-2">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

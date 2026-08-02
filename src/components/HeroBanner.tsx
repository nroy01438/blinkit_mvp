import Link from "next/link";

const FLOATING_ITEMS = [
  { emoji: "🥛", top: "10%", left: "55%", size: "text-3xl md:text-4xl" },
  { emoji: "🍌", top: "48%", left: "48%", size: "text-4xl md:text-5xl" },
  { emoji: "🥕", top: "14%", left: "70%", size: "text-3xl md:text-4xl" },
  { emoji: "🥚", top: "55%", left: "83%", size: "text-3xl md:text-4xl" },
  { emoji: "🍇", top: "8%", left: "90%", size: "text-4xl md:text-5xl" },
  { emoji: "🥦", top: "58%", left: "63%", size: "text-3xl md:text-4xl" },
];

/** The big top-of-homepage hero, styled after Blinkit's own "Stock up on
 * daily essentials" banner — headline + CTA on the left, a scattered
 * collage of grocery emoji standing in for real product photography on
 * the right (this is an unaffiliated concept prototype, so no real Blinkit
 * imagery is used anywhere in the app). */
export function HeroBanner() {
  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 pt-3">
      <div
        className="relative overflow-hidden rounded-2xl px-5 md:px-10 py-6 md:py-10 min-h-[190px] md:min-h-[260px] flex items-center"
        style={{ background: "linear-gradient(120deg, #3FAE5A 0%, #1B7A34 100%)" }}
      >
        <div className="relative z-10 max-w-[300px] md:max-w-[420px]">
          <h1 className="text-white text-[22px] md:text-[34px] font-extrabold leading-[1.15]">
            Stock up on daily essentials
          </h1>
          <p className="text-white/85 text-[12px] md:text-[15px] mt-2 md:mt-3 leading-snug">
            Get farm-fresh goodness &amp; a range of exotic fruits, vegetables, eggs &amp; more
          </p>
          <Link
            href="/category/fruits-vegetables"
            className="inline-block mt-4 md:mt-6 bg-white text-text-primary text-[12px] md:text-[14px] font-bold rounded-lg px-5 py-2.5 md:py-3"
          >
            Shop Now
          </Link>
        </div>

        <div className="hidden sm:block absolute inset-0" aria-hidden>
          {FLOATING_ITEMS.map((item, i) => (
            <span
              key={i}
              className={`absolute ${item.size} drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]`}
              style={{ top: item.top, left: item.left }}
            >
              {item.emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

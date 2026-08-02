import Link from "next/link";

const CARDS = [
  {
    title: "Pharmacy at your doorstep!",
    sub: "Cough syrups, pain relief sprays & more",
    href: "/category/personal-care",
    from: "#1FB6A8",
    to: "#0E8C82",
    emojis: ["💊", "🩹"],
  },
  {
    title: "Pet care supplies at your door",
    sub: "Food, treats, toys & more",
    href: "/category/pet-care",
    from: "#FFCB2D",
    to: "#F5A623",
    emojis: ["🐶", "🐱"],
  },
  {
    title: "No time for a diaper run?",
    sub: "Get baby care essentials",
    href: "/category/baby-care",
    from: "#6FA3E0",
    to: "#3E76BE",
    emojis: ["🍼", "👶"],
  },
];

/** Three square promo cards below the hero, mirroring Blinkit's own
 * pharmacy / pet care / baby care callouts — each a colored gradient card
 * with a headline, a short pitch, an "Order Now" pill, and a couple of
 * emoji standing in for real product photography. */
export function PromoCardsRow() {
  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CARDS.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="relative overflow-hidden rounded-2xl px-5 py-5 min-h-[150px] flex flex-col justify-between"
            style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
          >
            <div className="max-w-[68%]">
              <p className="text-white text-[16px] md:text-[18px] font-extrabold leading-tight">{c.title}</p>
              <p className="text-white/85 text-[11px] md:text-[12.5px] mt-1.5 leading-snug">{c.sub}</p>
            </div>
            <span className="inline-block w-fit bg-[#1F1F1F] text-white text-[11px] font-bold rounded-md px-3.5 py-2">
              Order Now
            </span>

            <div className="absolute bottom-2 right-2 flex" aria-hidden>
              {c.emojis.map((e, i) => (
                <span
                  key={i}
                  className="text-5xl md:text-6xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
                  style={{ marginLeft: i > 0 ? "-14px" : 0 }}
                >
                  {e}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

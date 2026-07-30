const BANNERS = [
  { text: "Flat ₹50 OFF on your first order", sub: "Use code AURKUCH", from: "#FFE9A8", to: "#FFCB2D" },
  { text: "Fresh fruits & veggies", sub: "At the best prices in town", from: "#C9F0CE", to: "#8FE0A0" },
  { text: "Baby care essentials", sub: "Trusted brands, delivered in 8 mins", from: "#C9E6FF", to: "#8FC7F5" },
];

export function PromoBanner() {
  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-2">
      <div className="flex gap-3 overflow-x-auto no-scrollbar">
        {BANNERS.map((b) => (
          <div
            key={b.text}
            className="shrink-0 w-[280px] md:w-[400px] h-[92px] md:h-[110px] rounded-xl px-4 flex flex-col justify-center"
            style={{ background: `linear-gradient(120deg, ${b.from}, ${b.to})` }}
          >
            <p className="text-[13px] md:text-[15px] font-extrabold text-text-primary leading-tight">{b.text}</p>
            <p className="text-[11px] md:text-[12px] text-text-secondary mt-0.5">{b.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

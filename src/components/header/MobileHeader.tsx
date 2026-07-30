import Link from "next/link";
import { SearchBar } from "@/components/header/SearchBar";
import { LocationPicker } from "@/components/header/LocationPicker";

export function MobileHeader({ city }: { city: string }) {
  return (
    <header className="md:hidden sticky top-0 z-40" style={{ background: "#F8CB46" }}>
      <div className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black text-[#0C831F] leading-none">Blinkit</span>
              <span className="text-[15px] font-extrabold text-text-primary leading-none">8 mins</span>
            </div>
            <LocationPicker city={city} />
          </div>
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-sm font-bold text-text-primary"
            aria-label="Account"
          >
            👤
          </Link>
        </div>
        <SearchBar compact />
      </div>
    </header>
  );
}

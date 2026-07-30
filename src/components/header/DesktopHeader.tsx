import Link from "next/link";
import { SearchBar } from "@/components/header/SearchBar";
import { LocationPicker } from "@/components/header/LocationPicker";
import { CartButton } from "@/components/header/CartButton";

export function DesktopHeader({ city, personaName }: { city: string; personaName: string }) {
  return (
    <header className="hidden md:block sticky top-0 z-40 bg-surface border-b border-divider">
      <div className="max-w-[1280px] mx-auto flex items-center gap-6 px-6 h-[72px]">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl font-black tracking-tight" style={{ color: "#0C831F" }}>
            blink<span style={{ color: "#F8CB46" }}>it</span>
          </span>
        </Link>

        <div className="flex flex-col justify-center shrink-0 border-r border-divider pr-6 mr-1 cursor-pointer">
          <span className="text-[14px] font-extrabold text-text-primary leading-tight">Delivery in 8 minutes</span>
          <LocationPicker city={city} />
        </div>

        <div className="flex-1 max-w-[520px]">
          <SearchBar />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end leading-tight text-right">
            <span className="text-[11px] text-text-muted">Viewing as</span>
            <span className="text-[13px] font-bold text-text-primary">{personaName}</span>
          </div>
          <CartButton />
        </div>
      </div>
    </header>
  );
}

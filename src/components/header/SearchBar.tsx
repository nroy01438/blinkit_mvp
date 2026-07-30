"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ROTATING_TERMS = ["milk", "bread", "eggs", "chips", "atta", "paneer"];

export function SearchBar({ compact = false, defaultValue = "" }: { compact?: boolean; defaultValue?: string }) {
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ROTATING_TERMS.length), 2000);
    return () => clearInterval(t);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <form
      onSubmit={submit}
      className={`flex items-center gap-2 bg-surface border border-divider rounded-lg px-3 ${
        compact ? "h-10" : "h-11"
      } w-full`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-text-muted shrink-0">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Search "${ROTATING_TERMS[idx]}"`}
        className="flex-1 bg-transparent outline-none text-[13px] text-text-primary placeholder:text-text-muted"
      />
    </form>
  );
}

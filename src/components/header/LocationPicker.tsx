"use client";

import { useState } from "react";

const ADDRESSES = ["Sector 45", "DLF Phase 3", "Indiranagar", "Bandra West"];

export function LocationPicker({ city }: { city: string }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(ADDRESSES[0]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[12px] text-text-secondary leading-tight text-left"
      >
        <span className="truncate max-w-[180px]">
          HOME - {address}, {city}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-surface border border-divider rounded-lg shadow-lg p-2 z-50 animate-fade-slide">
          <p className="text-[10px] font-semibold text-text-muted px-2 pb-1 uppercase tracking-wide">Saved addresses</p>
          {ADDRESSES.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAddress(a);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-page-bg text-[12px] text-text-primary"
            >
              {a}, {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Backdrop + slide-in drawer for the intercepted /cart route. Keeps the
 * page you navigated from visible (dimmed) behind the drawer instead of
 * the blank void a full route swap would otherwise leave — router.back()
 * pops the intercepted route and reveals it again. */
export function CartModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const close = () => router.back();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={close} aria-hidden />
      <div className="relative w-full md:max-w-[420px] h-full bg-surface md:shadow-2xl flex flex-col animate-slide-in-right">
        <button
          onClick={close}
          aria-label="Close cart"
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white border border-divider shadow-sm hover:bg-black/5 flex items-center justify-center text-text-primary text-sm"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

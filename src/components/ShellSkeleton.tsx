export function ShellSkeleton() {
  return (
    <>
      <header className="hidden md:block sticky top-0 z-40 bg-surface border-b border-divider">
        <div className="max-w-[1280px] mx-auto flex items-center gap-6 px-6 h-[72px] animate-pulse">
          <span className="text-2xl font-black tracking-tight text-action-green">
            blink<span className="text-brand-yellow-deep">it</span>
          </span>
          <div className="h-9 flex-1 max-w-[520px] rounded-lg bg-page-bg" />
          <div className="flex-1" />
          <div className="h-11 w-28 rounded-lg bg-page-bg" />
        </div>
      </header>
      <header className="md:hidden sticky top-0 z-40" style={{ background: "#F8CB46" }}>
        <div className="px-3 pt-3 pb-2.5 animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-28 rounded bg-white/40" />
            <div className="w-8 h-8 rounded-full bg-white/40" />
          </div>
          <div className="h-10 rounded-lg bg-white/60" />
        </div>
      </header>
    </>
  );
}

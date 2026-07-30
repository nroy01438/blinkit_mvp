export default function Loading() {
  return (
    <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-4 animate-pulse">
      <div className="flex gap-3 md:gap-5 mb-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-16 md:w-20">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-page-bg" />
            <div className="h-2 w-10 rounded bg-page-bg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-divider p-2">
            <div className="aspect-square w-full rounded-md bg-page-bg mb-2" />
            <div className="h-2.5 w-3/4 rounded bg-page-bg mb-1.5" />
            <div className="h-2.5 w-1/2 rounded bg-page-bg" />
          </div>
        ))}
      </div>
    </div>
  );
}

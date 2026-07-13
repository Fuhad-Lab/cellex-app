/**
 * Loading — skeleton view shown while a page is being loaded.
 *
 * This is Next.js's built-in loading.tsx convention. It automatically
 * wraps every route segment in a Suspense boundary and shows this
 * skeleton while the page's data is being fetched.
 *
 * The skeleton mimics the general layout of a Cellex page:
 *   - Top bar (back button + title placeholder)
 *   - Content blocks (shimmer cards)
 *   - Bottom nav placeholder
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-full bg-slate-100 shimmer" />
        <div className="flex-1 h-5 rounded-full bg-slate-100 shimmer" />
        <div className="w-8 h-8 rounded-full bg-slate-100 shimmer" />
      </div>

      {/* Content skeleton — mimics a product grid */}
      <div className="flex-1 p-4 space-y-4">
        {/* Hero banner placeholder */}
        <div className="w-full h-40 rounded-2xl bg-slate-100 shimmer" />

        {/* Section title */}
        <div className="w-32 h-4 rounded-full bg-slate-100 shimmer" />

        {/* Product grid 2x3 */}
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="w-full aspect-square rounded-xl bg-slate-100 shimmer" />
              <div className="w-3/4 h-3 rounded-full bg-slate-100 shimmer" />
              <div className="w-1/2 h-3 rounded-full bg-slate-100 shimmer" />
            </div>
          ))}
        </div>

        {/* Another section */}
        <div className="w-40 h-4 rounded-full bg-slate-100 shimmer" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-32 space-y-2">
              <div className="w-full h-32 rounded-xl bg-slate-100 shimmer" />
              <div className="w-3/4 h-3 rounded-full bg-slate-100 shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-2">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`rounded-full bg-slate-100 shimmer ${
                  i === 2 ? 'w-10 h-10' : 'w-5 h-5'
                }`}
              />
              <div className="w-10 h-2 rounded-full bg-slate-100 shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

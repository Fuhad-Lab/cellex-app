/**
 * PageSkeleton — reusable loading skeleton that matches each page's ACTUAL layout.
 *
 * KEY PRINCIPLE: The skeleton must have the EXACT same dimensions, spacing, and
 * structure as the real page content. When the content loads and replaces the
 * skeleton, there should be ZERO layout shift — elements should "fill in" the
 * skeleton placeholders perfectly.
 *
 * Each variant is hand-crafted to match its corresponding page's real layout.
 */

type Variant = 'feed' | 'grid' | 'detail' | 'list' | 'dashboard' | 'video' | 'chat' | 'minimal' | 'cart' | 'checkout' | 'orders' | 'search' | 'profile' | 'login';

export function PageSkeleton({ variant = 'grid' }: { variant?: Variant }) {
  switch (variant) {
    case 'feed':      return <FeedSkeleton />;
    case 'grid':      return <GridSkeleton />;
    case 'detail':    return <DetailSkeleton />;
    case 'list':      return <ListSkeleton />;
    case 'dashboard': return <DashboardSkeleton />;
    case 'video':     return <VideoSkeleton />;
    case 'chat':      return <ChatSkeleton />;
    case 'minimal':   return <MinimalSkeleton />;
    case 'cart':      return <CartSkeleton />;
    case 'checkout':  return <CheckoutSkeleton />;
    case 'orders':    return <OrdersSkeleton />;
    case 'search':    return <SearchSkeleton />;
    case 'profile':   return <ProfileSkeleton />;
    case 'login':     return <LoginSkeleton />;
    default:          return <GridSkeleton />;
  }
}

// ---- Reusable shimmer block ----
function S({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 shimmer rounded-lg ${className}`} />;
}

// ---- Feed (homepage) ----
// Matches: top bar (logo+search+messenger) → stories bar → feed posts (seller header + media + actions)
function FeedSkeleton() {
  return (
    <div className="bg-white min-h-screen max-w-xl mx-auto">
      {/* Top bar: logo + search + messenger */}
      <div className="px-3 pt-3 pb-2 bg-white sticky top-0 z-30 flex items-center gap-2">
        <S className="w-8 h-8 rounded-lg shrink-0" />
        <S className="flex-1 h-10 rounded-full" />
        <S className="w-10 h-10 rounded-full shrink-0" />
      </div>
      {/* Stories bar */}
      <div className="flex gap-3 px-3 py-2 border-b border-slate-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shrink-0 flex flex-col items-center gap-1">
            <S className="w-14 h-14 rounded-full" />
            <S className="w-10 h-2" />
          </div>
        ))}
      </div>
      {/* Feed posts */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border-b border-slate-100">
          {/* Seller header */}
          <div className="flex items-center gap-2 px-3 py-2">
            <S className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <S className="w-24 h-3 mb-1" />
              <S className="w-12 h-2" />
            </div>
            <S className="w-14 h-6 rounded-full" />
          </div>
          {/* Media */}
          <S className="w-full aspect-square" />
          {/* Action bar */}
          <div className="flex items-center gap-4 px-3 py-2">
            <S className="w-6 h-6" />
            <S className="w-6 h-6" />
            <S className="w-6 h-6" />
            <S className="w-6 h-6 ml-auto" />
          </div>
          {/* Caption */}
          <div className="px-3 pb-3 space-y-1.5">
            <S className="w-3/4 h-3" />
            <S className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Grid (categories, wishlist) ----
// Matches: search bar → category tabs → sort bar → 2-col product grid
function GridSkeleton() {
  return (
    <div className="bg-white min-h-screen">
      {/* Search bar */}
      <div className="sticky top-0 z-30 bg-white px-3 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2">
        <S className="w-5 h-5 shrink-0" />
        <S className="flex-1 h-9 rounded-full" />
      </div>
      {/* Category tabs */}
      <div className="flex items-center gap-5 px-3 py-2 border-b border-slate-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <S key={i} className="w-16 h-4 shrink-0" />
        ))}
      </div>
      {/* Sort bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <S className="w-20 h-3" />
        <S className="w-20 h-7 rounded-lg" />
      </div>
      {/* Product grid 2-col */}
      <div className="grid grid-cols-2 gap-2 px-3 py-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg overflow-hidden border border-slate-100">
            <S className="w-full aspect-square rounded-none" />
            <div className="p-2 space-y-1.5">
              <S className="w-full h-3" />
              <S className="w-2/3 h-3" />
              <S className="w-12 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Detail (product page) ----
// Matches: back btn → image gallery → price → title → seller card → buy buttons
function DetailSkeleton() {
  return (
    <div className="bg-white min-h-screen">
      {/* Top bar */}
      <div className="flex items-center px-3 py-3">
        <S className="w-9 h-9 rounded-full" />
      </div>
      {/* Image */}
      <S className="w-full aspect-square rounded-none" />
      {/* Image dots */}
      <div className="flex justify-center gap-1 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <S key={i} className="w-1.5 h-1.5 rounded-full" />
        ))}
      </div>
      {/* Price + title */}
      <div className="px-4 py-3 space-y-2">
        <S className="w-24 h-7" />
        <S className="w-3/4 h-5" />
        <S className="w-20 h-3" />
      </div>
      {/* Trust badges */}
      <div className="px-4 py-2 flex gap-2">
        <S className="w-24 h-6 rounded-full" />
        <S className="w-20 h-6 rounded-full" />
      </div>
      {/* Seller card */}
      <div className="px-4 py-3 flex items-center gap-3">
        <S className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <S className="w-20 h-3" />
          <S className="w-16 h-2" />
        </div>
        <S className="w-14 h-7 rounded-full" />
      </div>
      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 py-2 flex gap-2">
        <S className="w-10 h-10 rounded-lg" />
        <S className="w-10 h-10 rounded-lg" />
        <S className="flex-1 h-10 rounded-full" />
        <S className="flex-1 h-10 rounded-full" />
      </div>
    </div>
  );
}

// ---- List (generic list page) ----
function ListSkeleton() {
  return (
    <div className="bg-white min-h-screen p-4 space-y-3">
      <S className="w-32 h-6" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 border border-slate-100 rounded-xl">
          <S className="w-16 h-16 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-3/4 h-4" />
            <S className="w-1/2 h-3" />
            <S className="w-20 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Cart ----
// Matches: cart items list + sticky summary at bottom
function CartSkeleton() {
  return (
    <div className="bg-white min-h-screen max-w-3xl mx-auto p-4 space-y-3">
      <S className="w-20 h-7" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 border border-slate-100 rounded-xl">
          <S className="w-20 h-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-3/4 h-4" />
            <S className="w-16 h-5" />
            <div className="flex gap-2">
              <S className="w-8 h-8 rounded-lg" />
              <S className="w-8 h-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
      {/* Summary */}
      <div className="border-t border-slate-100 pt-4 space-y-2">
        <div className="flex justify-between"><S className="w-16 h-4" /><S className="w-20 h-4" /></div>
        <div className="flex justify-between"><S className="w-20 h-4" /><S className="w-16 h-4" /></div>
        <div className="flex justify-between"><S className="w-12 h-5" /><S className="w-24 h-5" /></div>
        <S className="w-full h-11 rounded-full mt-3" />
      </div>
    </div>
  );
}

// ---- Checkout ----
function CheckoutSkeleton() {
  return (
    <div className="bg-white min-h-screen max-w-2xl mx-auto p-4 space-y-4">
      <S className="w-28 h-7" />
      {/* Shipping form */}
      <div className="space-y-3">
        <S className="w-full h-11 rounded-lg" />
        <S className="w-full h-11 rounded-lg" />
        <S className="w-full h-20 rounded-lg" />
      </div>
      {/* Payment method */}
      <S className="w-full h-16 rounded-xl" />
      {/* Place order button */}
      <S className="w-full h-12 rounded-full" />
    </div>
  );
}

// ---- Orders ----
function OrdersSkeleton() {
  return (
    <div className="bg-white min-h-screen max-w-3xl mx-auto p-4 space-y-3">
      <S className="w-24 h-7" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-slate-100 rounded-xl p-3 space-y-2">
          <div className="flex justify-between">
            <S className="w-20 h-3" />
            <S className="w-16 h-5 rounded-full" />
          </div>
          <div className="flex gap-2">
            <S className="w-12 h-12 rounded-lg" />
            <S className="w-12 h-12 rounded-lg" />
            <S className="w-12 h-12 rounded-lg" />
          </div>
          <div className="flex justify-between">
            <S className="w-16 h-4" />
            <S className="w-20 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Search ----
// Matches: search bar + tabs + AI answer + product grid
function SearchSkeleton() {
  return (
    <div className="bg-white min-h-screen">
      {/* Search bar + tabs */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <S className="w-9 h-9 rounded-full shrink-0" />
          <S className="flex-1 h-10 rounded-full" />
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-4">
          <S className="w-10 h-6" />
          <S className="w-24 h-6" />
          <S className="w-16 h-6" />
        </div>
      </div>
      {/* AI answer */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        <div className="flex justify-end">
          <S className="w-32 h-9 rounded-2xl" />
        </div>
        <div className="flex items-start gap-3">
          <S className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-full h-3" />
            <S className="w-5/6 h-3" />
            <S className="w-4/6 h-3" />
          </div>
        </div>
        {/* Product cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <S className="w-full aspect-square" />
              <S className="w-3/4 h-3" />
              <S className="w-12 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Dashboard (seller) ----
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-4">
      <S className="w-32 h-7" />
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-xl space-y-2">
            <S className="w-8 h-8 rounded-lg" />
            <S className="w-16 h-6" />
            <S className="w-20 h-3" />
          </div>
        ))}
      </div>
      {/* Recent items */}
      <S className="w-28 h-5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-3 rounded-xl space-y-2">
            <S className="w-full aspect-square rounded-lg" />
            <S className="w-3/4 h-3" />
            <S className="w-16 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Video feed (TikTok-style) ----
function VideoSkeleton() {
  return (
    <div className="bg-black min-h-screen">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="relative w-full aspect-[9/16] bg-slate-900">
          <S className="w-full h-full rounded-none" />
          {/* Right action rail */}
          <div className="absolute right-2 bottom-20 flex flex-col gap-4">
            <S className="w-10 h-10 rounded-full" />
            <S className="w-10 h-10 rounded-full" />
            <S className="w-10 h-10 rounded-full" />
            <S className="w-10 h-10 rounded-full" />
          </div>
          {/* Bottom caption */}
          <div className="absolute bottom-4 left-4 right-16 space-y-2">
            <S className="w-24 h-4" />
            <S className="w-full h-3" />
            <S className="w-3/4 h-3" />
            <S className="w-32 h-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Chat (AI chat) ----
// Matches: header + chat bubbles + suggestion chips + input bar
function ChatSkeleton() {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
        <S className="w-9 h-9 rounded-full" />
        <div className="flex-1">
          <S className="w-32 h-4 mb-1" />
          <S className="w-20 h-2" />
        </div>
      </div>
      {/* Chat area */}
      <div className="flex-1 p-4 space-y-4">
        {/* User bubble */}
        <div className="flex justify-end">
          <S className="w-40 h-9 rounded-2xl" />
        </div>
        {/* AI bubble */}
        <div className="flex items-start gap-2">
          <S className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-full h-3" />
            <S className="w-5/6 h-3" />
            <S className="w-4/6 h-3" />
          </div>
        </div>
        {/* Product recommendation cards */}
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <S className="w-full aspect-square" />
              <S className="w-3/4 h-3" />
              <S className="w-12 h-4" />
            </div>
          ))}
        </div>
      </div>
      {/* Suggestion chips */}
      <div className="px-4 py-2 flex gap-2 flex-wrap">
        {Array.from({ length: 3 }).map((_, i) => (
          <S key={i} className="w-32 h-8 rounded-full" />
        ))}
      </div>
      {/* Input bar */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        <S className="w-10 h-10 rounded-full" />
        <S className="flex-1 h-10 rounded-full" />
        <S className="w-10 h-10 rounded-full" />
      </div>
    </div>
  );
}

// ---- Profile ----
function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <S className="w-24 h-7" />
      {/* User card */}
      <div className="bg-white p-4 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <S className="w-16 h-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <S className="w-24 h-4" />
            <S className="w-32 h-3" />
          </div>
          <S className="w-14 h-8 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-40 h-3" />
          <S className="w-32 h-3" />
        </div>
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 text-center space-y-1">
            <S className="w-6 h-5 mx-auto" />
            <S className="w-12 h-3 mx-auto" />
          </div>
        ))}
      </div>
      {/* Menu items */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
          <S className="w-10 h-10 rounded-xl" />
          <div className="flex-1 space-y-1">
            <S className="w-24 h-4" />
            <S className="w-16 h-3" />
          </div>
          <S className="w-4 h-4" />
        </div>
      ))}
    </div>
  );
}

// ---- Login ----
function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <S className="w-14 h-14 rounded-2xl mx-auto" />
          <S className="w-20 h-7 mx-auto" />
          <S className="w-32 h-3 mx-auto" />
        </div>
        <div className="space-y-3">
          <S className="w-32 h-5" />
          <S className="w-full h-11 rounded-lg" />
          <S className="w-32 h-5" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <S className="w-full h-11 rounded-full" />
      </div>
    </div>
  );
}

// ---- Minimal (fallback) ----
function MinimalSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <S className="w-24 h-8 mx-auto" />
        <S className="w-full h-12" />
        <S className="w-full h-12" />
        <S className="w-full h-12" />
      </div>
    </div>
  );
}

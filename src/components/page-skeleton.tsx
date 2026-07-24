/**
 * PageSkeleton — pixel-perfect loading skeletons that EXACTLY match each page's
 * actual DOM structure.
 *
 * KEY PRINCIPLE: When the real content loads and replaces the skeleton, there
 * must be ZERO layout shift. Every skeleton block has the same width, height,
 * padding, margin, border-radius, and position as its real counterpart.
 *
 * The shimmer class is defined in globals.css.
 */

type Variant =
  | 'home' | 'categories' | 'product' | 'cart' | 'checkout' | 'orders'
  | 'search' | 'profile' | 'login' | 'ai-chat' | 'videos' | 'live'
  | 'group-buy' | 'wishlist' | 'link-account' | 'telegram' | 'payment'
  | 'seller-dashboard' | 'seller-products' | 'seller-orders' | 'seller-profile'
  | 'seller-go-live' | 'seller-videos' | 'seller-stories' | 'seller-settings'
  | 'seller-academy' | 'become-seller' | 'settings' | 'messenger'
  | 'notifications' | 'create' | 'minimal';

export function PageSkeleton({ variant = 'minimal' }: { variant?: Variant }) {
  switch (variant) {
    case 'home':              return <HomeSkeleton />;
    case 'categories':        return <CategoriesSkeleton />;
    case 'product':           return <ProductSkeleton />;
    case 'cart':              return <CartSkeleton />;
    case 'checkout':          return <CheckoutSkeleton />;
    case 'orders':            return <OrdersSkeleton />;
    case 'search':            return <SearchSkeleton />;
    case 'profile':           return <ProfileSkeleton />;
    case 'login':             return <LoginSkeleton />;
    case 'ai-chat':           return <AIChatSkeleton />;
    case 'videos':            return <VideosSkeleton />;
    case 'live':              return <LiveSkeleton />;
    case 'group-buy':         return <GroupBuySkeleton />;
    case 'wishlist':          return <WishlistSkeleton />;
    case 'link-account':      return <LinkAccountSkeleton />;
    case 'telegram':          return <TelegramSkeleton />;
    case 'payment':           return <PaymentSkeleton />;
    case 'seller-dashboard':  return <SellerDashboardSkeleton />;
    case 'seller-products':   return <SellerProductsSkeleton />;
    case 'seller-orders':     return <SellerOrdersSkeleton />;
    case 'seller-profile':    return <SellerProfileSkeleton />;
    case 'seller-go-live':    return <SellerGoLiveSkeleton />;
    case 'seller-videos':     return <SellerVideosSkeleton />;
    case 'seller-stories':    return <SellerStoriesSkeleton />;
    case 'seller-settings':   return <SellerSettingsSkeleton />;
    case 'seller-academy':    return <SellerAcademySkeleton />;
    case 'become-seller':     return <BecomeSellerSkeleton />;
    case 'settings':          return <SettingsSkeleton />;
    case 'messenger':         return <MessengerSkeleton />;
    case 'notifications':     return <NotificationsSkeleton />;
    case 'create':            return <CreateSkeleton />;
    default:                  return <MinimalSkeleton />;
  }
}

// ---- Reusable shimmer block ----
function S({ className = '' }: { className?: string }) {
  return <div className={`shimmer ${className}`} />;
}

// ============================================================
// HOME (feed) — matches page.tsx exactly:
//   top bar (logo+search+icons) → stories bar → live banner → feed posts
// ============================================================
function HomeSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-xl mx-auto">
      {/* Top bar: logo + search + icons */}
      <div className="px-3 pt-3 pb-2 sticky top-0 z-30 flex items-center gap-2">
        <S className="w-8 h-8 rounded-lg shrink-0" />
        <S className="flex-1 h-10 rounded-full" />
        <S className="w-10 h-10 rounded-full shrink-0" />
      </div>
      {/* Stories bar */}
      <div className="flex gap-3 px-3 py-2 border-b border-white/5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shrink-0 flex flex-col items-center gap-1">
            <S className="w-14 h-14 rounded-full" />
            <S className="w-10 h-2" />
          </div>
        ))}
      </div>
      {/* Live banner */}
      <div className="px-3 mt-2">
        <S className="w-full h-12 rounded-xl" />
      </div>
      {/* Feed posts — match FeedPostCard structure */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border-b border-white/5">
          {/* Seller header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <S className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1">
              <S className="w-24 h-3 mb-1" />
              <S className="w-12 h-2" />
            </div>
            <S className="w-16 h-8 rounded-full" />
          </div>
          {/* Media — aspect-square */}
          <S className="w-full aspect-square rounded-none" />
          {/* Action bar */}
          <div className="flex items-center gap-4 px-3 py-2">
            <S className="w-6 h-6" />
            <S className="w-6 h-6" />
            <S className="w-6 h-6" />
            <S className="w-6 h-6 ml-auto" />
          </div>
          {/* Likes + caption */}
          <div className="px-3 pb-3 space-y-1.5">
            <S className="w-20 h-3" />
            <S className="w-3/4 h-3" />
            <S className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// CATEGORIES — matches categories/page.tsx:
//   search bar (sticky) → category tabs → subcategory grid → sort bar → 2-col grid
// ============================================================
function CategoriesSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen">
      {/* Search bar */}
      <div className="sticky top-0 z-30 px-3 pt-3 pb-2 border-b border-white/5 flex items-center gap-2">
        <S className="w-5 h-5 shrink-0" />
        <S className="flex-1 h-9 rounded-full" />
        <S className="w-5 h-5 shrink-0" />
      </div>
      {/* Category tabs */}
      <div className="flex items-center gap-5 px-3 py-2 border-b border-white/5">
        {Array.from({ length: 7 }).map((_, i) => (
          <S key={i} className="w-16 h-4 shrink-0" />
        ))}
      </div>
      {/* Subcategory grid (5-col) */}
      <div className="grid grid-cols-5 gap-2 px-3 py-3 border-b border-white/5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <S className="w-11 h-11 rounded-full" />
            <S className="w-10 h-2" />
          </div>
        ))}
      </div>
      {/* Sort bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <S className="w-20 h-3" />
        <S className="w-20 h-7 rounded-lg" />
      </div>
      {/* Product grid 2-col — matches MobileCategoryProductCard */}
      <div className="grid grid-cols-2 gap-2 px-3 py-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg overflow-hidden border border-white/5">
            <S className="w-full aspect-square rounded-none" />
            <div className="p-2 space-y-1.5">
              <S className="w-full h-3" />
              <S className="w-2/3 h-3" />
              <S className="w-16 h-3 rounded-full" />
              <S className="w-14 h-4" />
              <S className="w-10 h-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT DETAIL — matches product/page.tsx:
//   back btn → image gallery → price → title → trust badges → seller card →
//   group buy banner → reviews → details → bottom action bar
// ============================================================
function ProductSkeleton() {
  return (
    <div style={{ background: 'var(--cellex-bg)' }} className="min-h-screen pb-20">
      {/* Top bar with back button */}
      <div className="flex items-center px-3 py-3">
        <S className="w-9 h-9 rounded-full" />
      </div>
      {/* Image gallery — aspect-square */}
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
        <S className="w-28 h-5 rounded-full" />
        <S className="w-24 h-5 rounded-full" />
      </div>
      {/* Group buy banner */}
      <div className="mx-4 my-3">
        <S className="w-full h-16 rounded-xl" />
      </div>
      {/* Seller card */}
      <div className="px-4 py-3 flex items-center gap-3 border-t border-white/5">
        <S className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <S className="w-20 h-3" />
          <S className="w-16 h-2" />
        </div>
        <S className="w-14 h-7 rounded-full" />
      </div>
      {/* Reviews section */}
      <div className="px-4 py-3 border-t border-white/5 space-y-2">
        <S className="w-28 h-4" />
        <S className="w-full h-16 rounded-lg" />
      </div>
      {/* Bottom action bar — fixed */}
      <div className="fixed bottom-0 left-0 right-0 border-t px-3 py-2 flex gap-2 items-center" style={{ background: 'var(--cellex-surface)', borderColor: 'var(--cellex-border)' }}>
        <S className="w-10 h-10 rounded-lg" />
        <S className="w-10 h-10 rounded-lg" />
        <S className="flex-1 h-10 rounded-full" />
        <S className="flex-1 h-10 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================
// CART — matches cart/page.tsx:
//   header → cart items (image + name + qty controls) → summary
// ============================================================
function CartSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-3xl mx-auto px-4 py-4">
      <S className="w-20 h-7 mb-4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 border border-white/5 rounded-xl mb-3">
          <S className="w-20 h-20 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-3/4 h-4" />
            <S className="w-16 h-5" />
            <div className="flex items-center gap-2">
              <S className="w-8 h-8 rounded-lg" />
              <S className="w-6 h-4" />
              <S className="w-8 h-8 rounded-lg" />
            </div>
          </div>
          <S className="w-16 h-4" />
        </div>
      ))}
      {/* Summary */}
      <div className="border-t border-white/5 pt-4 mt-4 space-y-2">
        <div className="flex justify-between"><S className="w-16 h-4" /><S className="w-20 h-4" /></div>
        <div className="flex justify-between"><S className="w-20 h-4" /><S className="w-16 h-4" /></div>
        <div className="flex justify-between"><S className="w-12 h-5" /><S className="w-24 h-5" /></div>
        <S className="w-full h-11 rounded-full mt-3" />
      </div>
    </div>
  );
}

// ============================================================
// CHECKOUT — matches checkout/page.tsx:
//   header → shipping form fields → payment method card → place order button
// ============================================================
function CheckoutSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto px-4 py-4 space-y-4">
      <S className="w-28 h-7" />
      {/* Shipping form */}
      <div className="space-y-3">
        <S className="w-full h-11 rounded-lg" />
        <S className="w-full h-11 rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <S className="w-full h-11 rounded-lg" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <S className="w-full h-20 rounded-lg" />
      </div>
      {/* Payment method */}
      <S className="w-full h-16 rounded-xl" />
      {/* Place order button */}
      <S className="w-full h-12 rounded-full" />
    </div>
  );
}

// ============================================================
// ORDERS — matches orders/page.tsx:
//   header → order cards (header + item thumbnails + total)
// ============================================================
function OrdersSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-3xl mx-auto px-4 py-4">
      <S className="w-24 h-7 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-white/5 rounded-xl overflow-hidden">
            {/* Order header */}
            <div className="p-4 flex items-center gap-3">
              <S className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <S className="w-20 h-4" />
                <S className="w-16 h-2" />
              </div>
              <S className="w-16 h-5 rounded-full" />
            </div>
            {/* Item thumbnails */}
            <div className="px-4 pb-3 flex gap-2">
              <S className="w-12 h-12 rounded-lg" />
              <S className="w-12 h-12 rounded-lg" />
              <S className="w-12 h-12 rounded-lg" />
            </div>
            {/* Total */}
            <div className="px-4 py-3 border-t border-white/5 flex justify-between">
              <S className="w-16 h-4" />
              <S className="w-20 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SEARCH — matches search/page.tsx:
//   header (search bar + tabs) → AI answer bubble → product grid → follow-up input
// ============================================================
function SearchSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen">
      {/* Header with search + tabs */}
      <div className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5">
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
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* User query bubble */}
        <div className="flex justify-end">
          <S className="w-40 h-9 rounded-2xl" />
        </div>
        {/* AI answer */}
        <div className="flex items-start gap-3">
          <S className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-full h-3" />
            <S className="w-5/6 h-3" />
            <S className="w-4/6 h-3" />
          </div>
        </div>
        {/* Product recommendations */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <S className="w-full aspect-square rounded-lg" />
              <S className="w-3/4 h-3" />
              <S className="w-12 h-4" />
            </div>
          ))}
        </div>
      </div>
      {/* Follow-up input bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/5 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <S className="w-10 h-10 rounded-full" />
          <S className="flex-1 h-10 rounded-full" />
          <S className="w-10 h-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PROFILE — matches profile/page.tsx:
//   header → user card → stats grid → menu items → logout
// ============================================================
function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <S className="w-24 h-7" />
        <S className="w-9 h-9 rounded-full" />
      </div>
      {/* User card */}
      <div className="p-4 rounded-xl border border-white/5">
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
          <div key={i} className="p-3 rounded-xl border border-white/5 text-center space-y-1">
            <S className="w-6 h-5 mx-auto" />
            <S className="w-12 h-3 mx-auto" />
          </div>
        ))}
      </div>
      {/* Menu items */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl border border-white/5 flex items-center gap-3">
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

// ============================================================
// LOGIN — matches login/page.tsx:
//   centered logo → title → tab switcher → email/password form → submit button
// ============================================================
function LoginSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <S className="w-14 h-14 rounded-2xl mx-auto" />
          <S className="w-20 h-7 mx-auto" />
          <S className="w-32 h-3 mx-auto" />
        </div>
        {/* Tab switcher */}
        <S className="w-full h-10 rounded-xl" />
        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <S className="w-12 h-3" />
            <S className="w-full h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <S className="w-16 h-3" />
            <S className="w-full h-11 rounded-xl" />
          </div>
          <S className="w-full h-11 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AI CHAT — matches ai-chat/page.tsx:
//   header → messages (user bubble + AI bubble) → suggestion chips → input bar
// ============================================================
function AIChatSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
        <S className="w-9 h-9 rounded-xl shrink-0" />
        <div className="flex-1">
          <S className="w-32 h-4 mb-1" />
          <S className="w-20 h-2" />
        </div>
        <S className="w-8 h-8 rounded-lg" />
      </div>
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4">
        <div className="flex justify-end">
          <S className="w-40 h-9 rounded-2xl" />
        </div>
        <div className="flex items-start gap-2">
          <S className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-full h-3" />
            <S className="w-5/6 h-3" />
            <S className="w-4/6 h-3" />
          </div>
        </div>
      </div>
      {/* Suggestion chips */}
      <div className="px-4 py-2 flex gap-2 flex-wrap">
        {Array.from({ length: 3 }).map((_, i) => (
          <S key={i} className="w-32 h-8 rounded-full" />
        ))}
      </div>
      {/* Input bar */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
        <S className="w-10 h-10 rounded-full" />
        <S className="flex-1 h-10 rounded-full" />
        <S className="w-10 h-10 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================
// VIDEOS — TikTok-style vertical feed:
//   full-screen video cards with right action rail + bottom caption
// ============================================================
function VideosSkeleton() {
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

// ============================================================
// LIVE — matches live/page.tsx:
//   header → "LIVE NOW" section → grid of live session cards
// ============================================================
function LiveSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-5xl mx-auto px-4 py-4 space-y-6">
      <div className="flex items-center gap-2">
        <S className="w-6 h-6" />
        <S className="w-32 h-7" />
      </div>
      <div>
        <S className="w-24 h-5 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-white/5">
              <S className="w-full aspect-video" />
              <div className="p-3 space-y-2">
                <S className="w-3/4 h-4" />
                <S className="w-16 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GROUP BUY — matches group-buy/page.tsx:
//   back link → group buy banner → product card → join section
// ============================================================
function GroupBuySkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto px-4 py-4">
      <S className="w-32 h-4 mb-3" />
      {/* Group buy banner */}
      <S className="w-full h-24 rounded-2xl mb-4" />
      {/* Product card */}
      <div className="flex gap-3 p-3 border border-white/5 rounded-xl mb-4">
        <S className="w-20 h-20 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <S className="w-3/4 h-4" />
          <S className="w-16 h-5" />
          <S className="w-20 h-3" />
        </div>
      </div>
      {/* Join section */}
      <S className="w-full h-16 rounded-xl" />
    </div>
  );
}

// ============================================================
// WISHLIST — matches wishlist/page.tsx:
//   header → list of product cards (image + name + price + remove)
// ============================================================
function WishlistSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-4xl mx-auto px-4 py-4">
      <S className="w-28 h-7 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 border border-white/5 rounded-xl flex gap-3">
            <S className="w-20 h-20 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <S className="w-3/4 h-4" />
              <S className="w-16 h-5" />
              <S className="w-20 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// LINK ACCOUNT — matches link-account/page.tsx:
//   back link → header card → info card → steps
// ============================================================
function LinkAccountSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto px-4 py-4">
      <S className="w-32 h-4 mb-3" />
      <div className="flex items-center gap-3 mb-4">
        <S className="w-12 h-12 rounded-2xl" />
        <div>
          <S className="w-32 h-6 mb-1" />
          <S className="w-48 h-3" />
        </div>
      </div>
      <S className="w-full h-24 rounded-xl mb-4" />
      <S className="w-full h-12 rounded-xl" />
    </div>
  );
}

// ============================================================
// TELEGRAM — matches telegram/page.tsx:
//   back link → header → channel info card → features list
// ============================================================
function TelegramSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto px-4 py-4">
      <S className="w-32 h-4 mb-3" />
      <div className="flex items-center gap-3 mb-4">
        <S className="w-12 h-12 rounded-2xl" />
        <div>
          <S className="w-36 h-6 mb-1" />
          <S className="w-48 h-3" />
        </div>
      </div>
      <S className="w-full h-20 rounded-xl mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <S key={i} className="w-full h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT — matches payment/page.tsx:
//   steps indicator → payment details card → status card
// ============================================================
function PaymentSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto px-4 py-4 space-y-4">
      <S className="w-24 h-7" />
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <S key={i} className="w-8 h-8 rounded-full" />
        ))}
      </div>
      {/* Payment details */}
      <S className="w-full h-40 rounded-xl" />
      {/* Status */}
      <S className="w-full h-20 rounded-xl" />
    </div>
  );
}

// ============================================================
// SELLER DASHBOARD — matches seller-dashboard/page.tsx:
//   header → store profile card → stats grid → menu sections
// ============================================================
function SellerDashboardSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto pb-24">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
        <S className="w-9 h-9 rounded-full" />
        <S className="w-20 h-5" />
      </div>
      {/* Store header */}
      <div className="px-4 py-6 text-center border-b border-white/5">
        <S className="w-20 h-20 rounded-full mx-auto mb-3" />
        <S className="w-32 h-6 mx-auto mb-2" />
        <S className="w-24 h-3 mx-auto" />
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-white/5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center space-y-1">
            <S className="w-4 h-4 mx-auto" />
            <S className="w-8 h-4 mx-auto" />
            <S className="w-10 h-2 mx-auto" />
          </div>
        ))}
      </div>
      {/* Menu sections */}
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="px-4 py-3">
          <S className="w-16 h-3 mb-2" />
          <div className="border border-white/5 rounded-xl divide-y divide-white/5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <S className="w-9 h-9 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <S className="w-24 h-4" />
                  <S className="w-16 h-3" />
                </div>
                <S className="w-4 h-4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SELLER PRODUCTS — matches seller/products/page.tsx:
//   header → search bar → product grid with edit/delete overlays
// ============================================================
function SellerProductsSkeleton() {
  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      <S className="w-32 h-7" />
      <S className="w-full h-11 rounded-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-white/5">
            <S className="w-full aspect-square" />
            <div className="p-3 space-y-2">
              <S className="w-3/4 h-3" />
              <S className="w-16 h-4" />
              <div className="flex gap-2">
                <S className="flex-1 h-8 rounded-lg" />
                <S className="flex-1 h-8 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SELLER ORDERS — matches seller/orders/page.tsx:
//   header → order list with item breakdown
// ============================================================
function SellerOrdersSkeleton() {
  return (
    <div className="space-y-3 max-w-4xl mx-auto p-4">
      <S className="w-24 h-7 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-white/5 rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <S className="w-20 h-4" />
            <S className="w-16 h-5 rounded-full" />
          </div>
          <div className="flex gap-2">
            <S className="w-12 h-12 rounded-lg" />
            <S className="w-12 h-12 rounded-lg" />
          </div>
          <S className="w-16 h-4" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SELLER PROFILE (edit) — matches seller/profile/page.tsx:
//   header → logo upload → form fields → save button
// ============================================================
function SellerProfileSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <S className="w-32 h-7" />
      <div className="border border-white/5 rounded-xl p-4 space-y-3">
        <S className="w-16 h-16 rounded-2xl mx-auto" />
        <div className="space-y-2">
          <S className="w-20 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-16 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-24 h-3" />
          <S className="w-full h-20 rounded-lg" />
        </div>
      </div>
      <S className="w-full h-11 rounded-full" />
    </div>
  );
}

// ============================================================
// SELLER GO LIVE — matches seller/go-live/page.tsx:
//   header → form → active session card
// ============================================================
function SellerGoLiveSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <S className="w-24 h-7" />
      <div className="border border-white/5 rounded-xl p-4 space-y-3">
        <div className="space-y-2">
          <S className="w-20 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-16 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
      </div>
      <S className="w-full h-11 rounded-full" />
      <S className="w-full h-24 rounded-xl" />
    </div>
  );
}

// ============================================================
// SELLER VIDEOS — matches seller/videos/page.tsx:
//   header → post form → video list
// ============================================================
function SellerVideosSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <S className="w-24 h-7" />
      <div className="border border-white/5 rounded-xl p-4 space-y-3">
        <div className="space-y-2">
          <S className="w-20 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-16 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <S className="w-full h-11 rounded-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 border border-white/5 rounded-xl p-3">
          <S className="w-20 h-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="w-3/4 h-4" />
            <S className="w-16 h-3" />
            <div className="flex gap-2">
              <S className="w-12 h-3" />
              <S className="w-12 h-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SELLER STORIES — matches seller/stories/page.tsx:
//   header → story type selector → form
// ============================================================
function SellerStoriesSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <S className="w-24 h-7" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <S key={i} className="w-full h-16 rounded-xl" />
        ))}
      </div>
      <div className="border border-white/5 rounded-xl p-4 space-y-3">
        <div className="space-y-2">
          <S className="w-20 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-16 h-3" />
          <S className="w-full h-20 rounded-lg" />
        </div>
        <S className="w-full h-11 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================
// SELLER SETTINGS — matches seller/settings/page.tsx:
//   header → account → notifications → region → security → danger zone
// ============================================================
function SellerSettingsSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <S className="w-9 h-9 rounded-full" />
        <S className="w-20 h-7" />
      </div>
      {Array.from({ length: 4 }).map((_, section) => (
        <div key={section}>
          <S className="w-20 h-3 mb-2" />
          <div className="border border-white/5 rounded-xl divide-y divide-white/5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <S className="w-9 h-9 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <S className="w-24 h-4" />
                  <S className="w-16 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SELLER ACADEMY — matches seller/academy/page.tsx:
//   header → hero card → course cards grid
// ============================================================
function SellerAcademySkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <S className="w-24 h-7" />
      <S className="w-full h-32 rounded-xl" />
      <S className="w-32 h-5" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-white/5 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <S className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <S className="w-3/4 h-4" />
                <S className="w-full h-3" />
                <div className="flex gap-2">
                  <S className="w-12 h-4 rounded-full" />
                  <S className="w-16 h-4 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// BECOME SELLER — matches become-seller/page.tsx:
//   header + progress bar → form fields
// ============================================================
function BecomeSellerSkeleton() {
  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <S className="w-9 h-9 rounded-full" />
        <div className="flex-1">
          <S className="w-28 h-5 mb-1" />
          <S className="w-16 h-3" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <S key={i} className="h-1.5 flex-1 rounded-full" />
        ))}
      </div>
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2">
          <S className="w-24 h-24 rounded-full" />
        </div>
        <div className="space-y-1.5">
          <S className="w-20 h-3" />
          <S className="w-full h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <S className="w-16 h-3" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <S key={i} className="w-full h-14 rounded-xl" />
            ))}
          </div>
        </div>
        <S className="w-full h-11 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS — matches settings/page.tsx:
//   header → account → preferences → selling → support → security
// ============================================================
function SettingsSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <S className="w-9 h-9 rounded-full" />
        <S className="w-20 h-7" />
      </div>
      {Array.from({ length: 5 }).map((_, section) => (
        <div key={section}>
          <S className="w-20 h-3 mb-2" />
          <div className="border border-white/5 rounded-xl divide-y divide-white/5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <S className="w-9 h-9 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <S className="w-24 h-4" />
                  <S className="w-16 h-3" />
                </div>
                <S className="w-11 h-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MESSENGER — matches messenger/page.tsx:
//   header → tabs → conversation list
// ============================================================
function MessengerSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto">
      <div className="sticky top-0 z-30 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <S className="w-9 h-9 rounded-full" />
        <S className="w-24 h-6 flex-1" />
        <S className="w-9 h-9 rounded-full" />
      </div>
      <div className="border-b border-white/5 px-2 flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <S key={i} className="w-16 h-6 my-3" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
          <S className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <S className="w-24 h-4" />
            <S className="w-40 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// NOTIFICATIONS — matches notifications/page.tsx:
//   header → notification list with typed icons
// ============================================================
function NotificationsSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-2xl mx-auto">
      <div className="sticky top-0 z-30 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <S className="w-9 h-9 rounded-full" />
        <S className="w-28 h-6 flex-1" />
        <S className="w-20 h-3" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50">
          <S className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <S className="w-32 h-4" />
            <S className="w-full h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// CREATE — matches create/page.tsx:
//   header → option cards
// ============================================================
function CreateSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen max-w-md mx-auto">
      <div className="sticky top-0 z-30 border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <S className="w-16 h-6" />
        <S className="w-9 h-9 rounded-full" />
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/5">
            <S className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <S className="w-24 h-4" />
              <S className="w-32 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MINIMAL (fallback)
// ============================================================
function MinimalSkeleton() {
  return (
    <div style={{ background: "var(--cellex-bg)" }} className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <S className="w-24 h-8 mx-auto" />
        <S className="w-full h-12" />
        <S className="w-full h-12" />
        <S className="w-full h-12" />
      </div>
    </div>
  );
}

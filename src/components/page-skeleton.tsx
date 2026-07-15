/**
 * PageSkeleton — reusable loading skeleton for any page.
 *
 * Variants:
 *   - 'feed'     : home page (hero banner + product grid + horizontal scroll)
 *   - 'grid'     : categories, search, wishlist (product grid only)
 *   - 'detail'   : product detail page (image + info + reviews)
 *   - 'list'     : orders, cart (list items)
 *   - 'dashboard': seller dashboard (stats + recent items)
 *   - 'video'    : videos page (vertical video cards)
 *   - 'chat'     : ai-chat page (chat bubbles)
 *   - 'minimal'  : login, profile, settings (simple centered card)
 */
import { Card } from '@/components/ui/card';

type Variant = 'feed' | 'grid' | 'detail' | 'list' | 'dashboard' | 'video' | 'chat' | 'minimal';

export function PageSkeleton({ variant = 'grid' }: { variant?: Variant }) {
  switch (variant) {
    case 'feed':
      return <FeedSkeleton />;
    case 'grid':
      return <GridSkeleton />;
    case 'detail':
      return <DetailSkeleton />;
    case 'list':
      return <ListSkeleton />;
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'video':
      return <VideoSkeleton />;
    case 'chat':
      return <ChatSkeleton />;
    case 'minimal':
      return <MinimalSkeleton />;
    default:
      return <GridSkeleton />;
  }
}

function ShimmerBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 shimmer rounded-lg ${className}`} />;
}

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-white p-4 space-y-6">
      <ShimmerBlock className="w-full h-48" />
      <ShimmerBlock className="w-32 h-5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock className="w-full aspect-square" />
            <ShimmerBlock className="w-3/4 h-3" />
            <ShimmerBlock className="w-1/2 h-3" />
          </div>
        ))}
      </div>
      <ShimmerBlock className="w-40 h-5" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-28 space-y-2">
            <ShimmerBlock className="w-full h-28" />
            <ShimmerBlock className="w-3/4 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="min-h-screen bg-white p-4 space-y-4">
      <ShimmerBlock className="w-full h-12" />
      <ShimmerBlock className="w-32 h-5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock className="w-full aspect-square" />
            <ShimmerBlock className="w-3/4 h-3" />
            <ShimmerBlock className="w-1/2 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-white space-y-4">
      <div className="flex items-center gap-3 px-4 py-3">
        <ShimmerBlock className="w-9 h-9 rounded-full" />
        <ShimmerBlock className="flex-1 h-5" />
      </div>
      <ShimmerBlock className="w-full aspect-square" />
      <div className="px-4 space-y-3">
        <ShimmerBlock className="w-3/4 h-6" />
        <ShimmerBlock className="w-1/3 h-7" />
        <ShimmerBlock className="w-full h-20" />
        <div className="flex gap-2">
          <ShimmerBlock className="flex-1 h-12" />
          <ShimmerBlock className="flex-1 h-12" />
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="min-h-screen bg-white p-4 space-y-4">
      <ShimmerBlock className="w-32 h-6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <ShimmerBlock className="w-20 h-20 shrink-0" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="w-3/4 h-4" />
            <ShimmerBlock className="w-1/2 h-3" />
            <ShimmerBlock className="w-full h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-6">
      <ShimmerBlock className="w-40 h-7" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="w-full h-24" />
        ))}
      </div>
      <ShimmerBlock className="w-32 h-5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock className="w-full aspect-square" />
            <ShimmerBlock className="w-3/4 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoSkeleton() {
  return (
    <div className="min-h-screen bg-black p-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <ShimmerBlock className="w-24 h-40 shrink-0 bg-slate-800" />
          <div className="flex-1 space-y-2 pt-2">
            <ShimmerBlock className="w-3/4 h-4 bg-slate-800" />
            <ShimmerBlock className="w-1/2 h-3 bg-slate-800" />
            <ShimmerBlock className="w-1/3 h-3 bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="min-h-screen bg-white p-4 space-y-6">
      <div className="flex justify-end">
        <ShimmerBlock className="w-48 h-10 rounded-2xl" />
      </div>
      <div className="flex items-start gap-3">
        <ShimmerBlock className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBlock className="w-full h-4" />
          <ShimmerBlock className="w-5/6 h-4" />
          <ShimmerBlock className="w-4/6 h-4" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock className="w-full aspect-square" />
            <ShimmerBlock className="w-3/4 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MinimalSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <ShimmerBlock className="w-24 h-8 mx-auto" />
        <ShimmerBlock className="w-full h-12" />
        <ShimmerBlock className="w-full h-12" />
        <ShimmerBlock className="w-full h-12" />
      </div>
    </div>
  );
}

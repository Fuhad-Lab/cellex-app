'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Package, Video, Radio, BookOpen, Sparkles, ShoppingBag, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';

export default function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSeller, setIsSeller] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/create');
      return;
    }
    if (user) {
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/seller-profile`, {
      credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.seller) {
              setIsSeller(true);
            }
          }
        } catch {}
        setChecking(false);
      })();
    }
  }, [user, authLoading, router]);

  if (authLoading || checking) {
    return (
      <PageSkeleton variant="create" />
    );
  }

  // Buyer create options (limited)
  const buyerOptions = [
    { href: '/ai-chat', icon: Sparkles, label: 'Ask AI', desc: 'Find products with AI' },
    { href: '/become-seller', icon: Package, label: 'Become a Seller', desc: 'Start your store' },
  ];

  // Seller create options (full)
  const sellerOptions = [
    { href: '/seller/products', icon: Package, label: 'Add Product', desc: 'List a new product' },
    { href: '/seller/videos', icon: Video, label: 'Post Video', desc: 'Showcase a product' },
    { href: '/seller/go-live', icon: Radio, label: 'Go Live', desc: 'Start a live session' },
    { href: '/seller/stories', icon: BookOpen, label: 'Post Story', desc: '24h story post' },
  ];

  const options = isSeller ? sellerOptions : buyerOptions;

  return (
    <div className="ig-container bg-white min-h-screen ig-topbar-offset">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Create</h1>
        <button onClick={() => router.push('/')} className="ig-icon-btn" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {!isSeller && (
          <div className="bg-neutral-50 rounded-md p-4 mb-4 text-center">
            <ShoppingBag className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-600 mb-3">
              Want to sell? Become a seller to unlock product posting, live streaming, and more.
            </p>
            <Link
              href="/become-seller"
              className="inline-block bg-black text-white text-sm font-semibold px-6 py-2.5 rounded-md"
            >
              Become a Seller
            </Link>
          </div>
        )}

        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <Link
              key={opt.href}
              href={opt.href}
              className="flex items-center gap-3 p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-black" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{opt.label}</div>
                <div className="text-xs text-neutral-500">{opt.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

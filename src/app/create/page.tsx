'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  X, Package, Video, Radio, BookOpen, Sparkles, ShoppingBag
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

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
          const resp = await fetch('/api/seller-profile', {
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // Buyer create options (limited)
  const buyerOptions = [
    { href: '/ai-chat', icon: Sparkles, label: 'Ask AI', desc: 'Find products with AI', color: 'bg-purple-100 text-purple-600' },
    { href: '/become-seller', icon: Package, label: 'Become a Seller', desc: 'Start your store', color: 'bg-green-100 text-green-600' },
  ];

  // Seller create options (full)
  const sellerOptions = [
    { href: '/seller/products', icon: Package, label: 'Add Product', desc: 'List a new product', color: 'bg-blue-100 text-blue-600' },
    { href: '/seller/videos', icon: Video, label: 'Post Video', desc: 'Showcase a product', color: 'bg-red-100 text-red-600' },
    { href: '/seller/go-live', icon: Radio, label: 'Go Live', desc: 'Start a live session', color: 'bg-red-100 text-red-600' },
    { href: '/seller/stories', icon: BookOpen, label: 'Post Story', desc: '24h story post', color: 'bg-orange-100 text-orange-600' },
  ];

  const options = isSeller ? sellerOptions : buyerOptions;

  return (
    <div className="bg-white min-h-screen max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Create</h1>
        <Link href="/" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
          <X className="w-5 h-5" />
        </Link>
      </div>

      {/* Options */}
      <div className="p-4 space-y-2">
        {!isSeller && (
          <div className="bg-slate-50 rounded-xl p-4 mb-4 text-center">
            <ShoppingBag className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 mb-3">
              Want to sell? Become a seller to unlock product posting, live streaming, and more.
            </p>
            <Link
              href="/become-seller"
              className="inline-block bg-black text-white text-sm font-bold px-6 py-2.5 rounded-full"
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
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

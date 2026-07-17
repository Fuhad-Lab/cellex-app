'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import {
  LayoutDashboard, Package, ShoppingBag, User, Radio, Video, BookOpen,
  Store, LogOut, Menu, X, Settings, GraduationCap
} from 'lucide-react';

const navItems = [
  { href: '/seller', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
  { href: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/seller/profile', label: 'Profile', icon: User },
  { href: '/seller/go-live', label: 'Go Live', icon: Radio },
  { href: '/seller/videos', label: 'Videos', icon: Video },
  { href: '/seller/stories', label: 'Stories', icon: BookOpen },
  { href: '/seller/academy', label: 'Academy', icon: GraduationCap },
  { href: '/seller/settings', label: 'Settings', icon: Settings },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/seller');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2 px-4 py-5 mb-2">
        <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
          <Store className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-extrabold text-sm" style={{ fontFamily: 'var(--font-geist-mono)' }}>Cellex</div>
          <div className="text-[10px] text-neutral-500">Seller Center</div>
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-black text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-neutral-100">
        <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100">
          <Store className="w-4 h-4" /> Back to store
        </Link>
        <button
          onClick={async () => { await logout(); router.push('/'); }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ed4956] hover:bg-red-50 w-full"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-neutral-200 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Seller Center</span>
        </div>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-white flex flex-col">
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

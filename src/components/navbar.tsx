'use client';

import InternalLink from '@/components/internal-link';
import { useAuth } from '@/components/auth-provider';
import { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, User, ChevronDown, Store, Heart, Package, LogOut, Link2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

const categories = [
  { label: 'AI Mode', href: '/ai-chat', highlight: true },
  { label: 'Explore', href: '/categories' },
  { label: '⚡ Flash Deals', href: '/categories?sort=flash' },
  { label: '🌱 Farm Fresh', href: '/categories?category=Farm' },
  { label: '📱 Phones', href: '/categories?category=Electronics' },
  { label: '💻 Electronics', href: '/categories?category=Electronics' },
  { label: '👗 Fashion', href: '/categories?category=Fashion' },
  { label: '🏠 Home', href: '/categories?category=Home' },
  { label: '💄 Beauty', href: '/categories?category=Beauty' },
  { label: '⚽ Sports', href: '/categories?category=Sports' },
  { label: '📚 Books', href: '/categories?category=Books' },
  { label: '🎬 Videos', href: '/videos' },
  { label: '🔴 Live', href: '/live' },
];

export function Navbar() {
  const { user, cartCount, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`, { scroll: false });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Logo */}
          <InternalLink href="/" className="flex items-center gap-2 shrink-0">
            <div
              className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center glow"
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              <span className="text-white font-extrabold text-lg">C</span>
            </div>
            <span
              className="text-xl font-extrabold brand-text hidden sm:block"
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              Cellex
            </span>
          </InternalLink>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl flex items-center border-2 border-white/10 rounded-full px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
            <Search className="text-slate-400 mr-2 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="flex-1 bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400"
            />
            <button type="submit" className="text-primary hover:text-primary/70 ml-2">
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5">
            <InternalLink href="/" className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors">
              Home
            </InternalLink>
            <InternalLink href="/categories" className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors">
              Category
            </InternalLink>
            <InternalLink href="/cart" className="relative text-slate-600 hover:text-primary transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </InternalLink>

            {/* Account */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"
                >
                  <div className="w-8 h-8 rounded-full brand-gradient text-white flex items-center justify-center font-bold text-sm">
                    {(user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden lg:inline">{user.email?.split('@')[0]}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-white/5 py-2 z-50">
                    <InternalLink href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <User className="w-4 h-4 text-primary" /> My Profile
                    </InternalLink>
                    <InternalLink href="/orders" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Package className="w-4 h-4 text-primary" /> My Orders
                    </InternalLink>
                    <InternalLink href="/wishlist" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Heart className="w-4 h-4 text-primary" /> Wishlist
                    </InternalLink>
                    <div className="border-t border-white/5 my-1" />
                    <InternalLink href="/seller-dashboard" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Store className="w-4 h-4 text-primary" /> Seller Dashboard
                    </InternalLink>
                    <InternalLink href="/link-account" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Link2 className="w-4 h-4 text-primary" /> Link WhatsApp
                    </InternalLink>
                    <InternalLink href="/telegram" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Send className="w-4 h-4 text-primary" /> Telegram Alerts
                    </InternalLink>
                    <div className="border-t border-white/5 my-1" />
                    <button
                      onClick={() => { logout(); window.location.href = '/'; }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <InternalLink href="/login" className="text-sm font-semibold text-slate-600 hover:text-primary">
                Account
              </InternalLink>
            )}
          </div>

          {/* Mobile cart */}
          <InternalLink href="/cart" className="md:hidden relative text-slate-600">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </InternalLink>
        </div>

        {/* Category bar — hidden on home page (mobile + desktop layouts have their own) */}
        <div className="flex items-center gap-1 py-2 overflow-x-auto no-scrollbar home-category-bar">
          {categories.map((cat) => (
            <InternalLink
              key={cat.label}
              href={cat.href}
              className={`text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                cat.highlight
                  ? 'brand-gradient text-primary-foreground font-bold'
                  : 'text-slate-600 hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {cat.label}
            </InternalLink>
          ))}
        </div>
      </div>
    </header>
  );
}

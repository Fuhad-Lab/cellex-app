'use client';

import Link from 'next/link';
import { Search, Plus, Store, Bell, Settings, ShoppingBag, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useRef, useEffect } from 'react';
import { MagneticButton } from '@/components/animation-provider';

/**
 * MobileHeader — unified header for all mobile pages.
 *
 * Three states:
 *
 * 1. Unauthenticated (no user):
 *    Logo | Search bar | [Login] [Sign up] buttons
 *
 * 2. Buyer (authenticated, not a seller):
 *    Logo | Search bar | Notification bell | Profile avatar (with image or initial)
 *
 * 3. Buyer-Seller (authenticated + seller):
 *    Logo | Search bar | + button | My Shop icon | Notification bell | Settings icon
 *
 * The "?" profile placeholder for unauthenticated users was REMOVED — that was bad UX.
 * Unauthenticated users see clear "Login" and "Sign up" buttons instead.
 */
export function MobileHeader() {
  const { user, isSeller, sellerChecked } = useAuth();
  const searchBarRef = useRef<HTMLButtonElement>(null);

  const openSpotlight = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-spotlight'));
    }
  };

  // Extract display info from the user object.
  // The user's profile_image comes from /api/profile (buyer profile).
  // For sellers, we use the seller record's profile_image instead — but to keep
  // the header fast and synchronous, we just check the buyer profile here.
  const profileImage = (user as any)?.profile_image || (user as any)?.user_metadata?.profile_image;
  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 px-4 md:hidden"
      style={{
        height: '64px',
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      {/* Logo — left */}
      <Link href="/" className="shrink-0 flex items-center gap-2">
        <div
          className="flex items-center justify-center"
          style={{ width: '40px', height: '40px', background: '#111827', borderRadius: '10px' }}
          aria-hidden
        >
          <ShoppingBag className="w-5 h-5" style={{ color: '#FFFFFF' }} strokeWidth={2} />
        </div>
        <span className="font-bold tracking-tight" style={{ fontSize: '20px', color: '#111827' }}>
          Cellex
        </span>
      </Link>

      {/* Search bar — center */}
      <button
        ref={searchBarRef}
        onClick={openSpotlight}
        className="flex-1 flex items-center gap-2 px-4 text-left transition-colors"
        style={{ height: '44px', background: '#F3F4F6', borderRadius: '999px', border: 'none', minWidth: 0 }}
        aria-label="Search products, sellers, hashtags"
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: '#9CA3AF' }} strokeWidth={2} />
        <span className="truncate" style={{ fontSize: '14px', color: '#9CA3AF' }}>
          Search products, sellers, hashtags...
        </span>
      </button>

      {/* Right — depends on auth state */}
      <div className="shrink-0 flex items-center gap-1.5">
        {!user ? (
          // ===== UNAUTHENTICATED: Login + Sign up buttons =====
          // No more "?" placeholder — that was bad UX.
          // Use compact pill buttons so they fit on small screens.
          <>
            <Link
              href="/login"
              className="flex items-center justify-center transition-opacity active:opacity-70 link-underline"
              style={{
                height: '36px',
                padding: '0 14px',
                borderRadius: '999px',
                border: '1px solid #E5E7EB',
                background: '#FFFFFF',
              }}
              aria-label="Log in"
            >
              <span className="text-xs font-semibold" style={{ color: '#111827' }}>Log in</span>
            </Link>
            <MagneticButton strength={0.2}>
              <Link
                href="/login?mode=signup"
                className="flex items-center justify-center transition-opacity active:opacity-70 btn-ripple"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  background: '#111827',
                }}
                aria-label="Sign up"
              >
                <span className="text-xs font-semibold" style={{ color: '#FFFFFF' }}>Sign up</span>
              </Link>
            </MagneticButton>
          </>
        ) : isSeller ? (
          // ===== BUYER-SELLER: + button, My Shop, Bell, Settings =====
          <>
            {/* + button — create post or product */}
            <Link
              href="/create"
              className="flex items-center justify-center transition-opacity active:opacity-70"
              style={{ width: '36px', height: '36px', borderRadius: '999px' }}
              aria-label="Create post or product"
            >
              <Plus className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={2} />
            </Link>
            {/* My Shop icon — seller dashboard */}
            <Link
              href="/seller-dashboard"
              className="flex items-center justify-center transition-opacity active:opacity-70"
              style={{ width: '36px', height: '36px', borderRadius: '999px' }}
              aria-label="My Shop"
            >
              <Store className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={1.75} />
            </Link>
            {/* Notification bell */}
            <Link
              href="/notifications"
              className="flex items-center justify-center relative transition-opacity active:opacity-70"
              style={{ width: '36px', height: '36px', borderRadius: '999px' }}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={1.75} />
            </Link>
            {/* Settings gear */}
            <Link
              href="/settings"
              className="flex items-center justify-center transition-opacity active:opacity-70"
              style={{ width: '36px', height: '36px', borderRadius: '999px' }}
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={1.75} />
            </Link>
          </>
        ) : (
          // ===== BUYER: Profile avatar + Notification bell =====
          // (Profile icon FIRST, then Notification icon — per spec)
          <>
            {/* Profile avatar — buyer only. Shows their profile picture or initial. */}
            <Link
              href="/profile"
              className="flex items-center justify-center overflow-hidden transition-opacity active:opacity-70"
              style={{ width: '36px', height: '36px', borderRadius: '999px', border: '2px solid #E5E7EB' }}
              aria-label="Profile"
            >
              {profileImage ? (
                <img src={profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#111827' }}>
                  <span className="text-xs font-bold" style={{ color: '#FFFFFF' }}>
                    {userInitial}
                  </span>
                </div>
              )}
            </Link>
            {/* Notification bell */}
            <Link
              href="/notifications"
              className="flex items-center justify-center relative transition-opacity active:opacity-70"
              style={{ width: '36px', height: '36px', borderRadius: '999px' }}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={1.75} />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

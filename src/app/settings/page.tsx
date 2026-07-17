'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { ChevronLeft, ChevronRight, Bell, Globe, Shield, Store, LogOut,
  HelpCircle, Mail, Phone, User, Star, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/page-skeleton';

export default function SettingsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [isSeller, setIsSeller] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/settings');
      return;
    }
    if (user) {
      (async () => {
        const profileResp = await api.profile.get();
        if (profileResp.success && profileResp.profile) {
          setProfile(profileResp.profile);
        }
        // Check seller status
        try {
          const sellerResp = await fetch('/api/seller-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (sellerResp.ok) {
            const sellerData = await sellerResp.json();
            if (sellerData.success && sellerData.seller) {
              setIsSeller(true);
            }
          }
        } catch {}
      })();
    }
  }, [user, authLoading, router]);

  if (authLoading) { return <PageSkeleton variant="settings" />; }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const sectionLabel = "text-xs font-semibold text-neutral-500 uppercase tracking-wide px-4 mb-2";

  return (
    <div className="ig-container bg-white min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.push('/profile')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Settings</h1>
      </div>

      {/* Account section */}
      <div className="pt-4">
        <h2 className={sectionLabel}>Account</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Link href="/profile" className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors">
            <User className="w-5 h-5 text-black shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Edit Profile</div>
              <div className="text-xs text-neutral-500">{profile?.full_name || user?.email}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300" />
          </Link>

          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail className="w-5 h-5 text-neutral-500 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Email</div>
              <div className="text-xs text-neutral-500">{user?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3.5">
            <Phone className="w-5 h-5 text-neutral-500 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Phone</div>
              <div className="text-xs text-neutral-500">{profile?.phone || 'Not set'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="pt-6">
        <h2 className={sectionLabel}>Preferences</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <ToggleRow icon={Bell} label="Push Notifications" desc="Order updates & deals" defaultOn />
          <ToggleRow icon={Star} label="Email Digest" desc="Weekly recommendation" defaultOn />
          <ToggleRow icon={Globe} label="Location Services" desc="For local product suggestions" />
        </div>
      </div>

      {/* Seller section */}
      <div className="pt-6">
        <h2 className={sectionLabel}>Selling</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {isSeller ? (
            <Link href="/seller" className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors">
              <Store className="w-5 h-5 text-black shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-sm">Seller Dashboard</div>
                <div className="text-xs text-neutral-500">Manage your products, orders & analytics</div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300" />
            </Link>
          ) : (
            <Link href="/become-seller" className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors">
              <Store className="w-5 h-5 text-black shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-sm">Become a Seller</div>
                <div className="text-xs text-neutral-500">Start selling on Cellex — it's free</div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300" />
            </Link>
          )}
        </div>
      </div>

      {/* Support */}
      <div className="pt-6">
        <h2 className={sectionLabel}>Support</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Link href="/telegram" className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors">
            <HelpCircle className="w-5 h-5 text-black shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Help & Support</div>
              <div className="text-xs text-neutral-500">Get help via Telegram</div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300" />
          </Link>
          <Link href="/ai-chat" className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors">
            <Sparkles className="w-5 h-5 text-black shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Ask AI Assistant</div>
              <div className="text-xs text-neutral-500">Get instant help from our AI</div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300" />
          </Link>
        </div>
      </div>

      {/* Security */}
      <div className="pt-6">
        <h2 className={sectionLabel}>Security</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Shield className="w-5 h-5 text-neutral-500 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Account Security</div>
              <div className="text-xs text-neutral-500">HTTP-only cookie auth · 7-day session</div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-6">
        <button onClick={handleLogout} className="w-full text-[#ed4956] border border-neutral-200 hover:bg-neutral-50 rounded-md py-2.5 text-sm font-semibold">
          <LogOut className="w-4 h-4 inline mr-2" /> Logout
        </button>
      </div>

      <div className="text-center text-[10px] text-neutral-400 pt-4">
        Cellex v0.2.15 · Nigeria's #1 social marketplace
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, defaultOn }: { icon: any; label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon className="w-5 h-5 text-neutral-500 shrink-0" />
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-neutral-500">{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-black' : 'bg-neutral-200'}`}
        aria-pressed={on}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

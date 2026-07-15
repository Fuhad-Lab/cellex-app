'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/profile" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Account section */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">Account</h2>
        <Card className="border-slate-100 divide-y divide-slate-100">
          {/* Edit profile */}
          <Link href="/profile" className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Edit Profile</div>
              <div className="text-xs text-slate-500">{profile?.full_name || user?.email}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>

          {/* Email */}
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Email</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Phone</div>
              <div className="text-xs text-slate-500">{profile?.phone || 'Not set'}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Preferences */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">Preferences</h2>
        <Card className="border-slate-100 divide-y divide-slate-100">
          <ToggleRow icon={Bell} label="Push Notifications" desc="Order updates & deals" defaultOn />
          <ToggleRow icon={Star} label="Email Digest" desc="Weekly recommendations" defaultOn />
          <ToggleRow icon={Globe} label="Location Services" desc="For local product suggestions" />
        </Card>
      </div>

      {/* Seller section */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">Selling</h2>
        <Card className="border-slate-100 divide-y divide-slate-100">
          {isSeller ? (
            <Link href="/seller" className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Seller Dashboard</div>
                <div className="text-xs text-slate-500">Manage your products, orders & analytics</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
          ) : (
            <Link href="/become-seller" className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Become a Seller</div>
                <div className="text-xs text-slate-500">Start selling on Cellex — it's free</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
          )}
        </Card>
      </div>

      {/* Support */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">Support</h2>
        <Card className="border-slate-100 divide-y divide-slate-100">
          <Link href="/telegram" className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Help & Support</div>
              <div className="text-xs text-slate-500">Get help via Telegram</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
          <Link href="/ai-chat" className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Ask AI Assistant</div>
              <div className="text-xs text-slate-500">Get instant help from our AI</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        </Card>
      </div>

      {/* Security */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">Security</h2>
        <Card className="border-slate-100 divide-y divide-slate-100">
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Account Security</div>
              <div className="text-xs text-slate-500">HTTP-only cookie auth · 7-day session</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Logout */}
      <Button onClick={handleLogout} variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50">
        <LogOut className="w-4 h-4 mr-2" /> Logout
      </Button>

      <div className="text-center text-[10px] text-slate-400 pt-2">
        Cellex v0.2.15 · Nigeria's #1 social marketplace
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, defaultOn }: { icon: any; label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-black' : 'bg-slate-200'}`}
        aria-pressed={on}
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

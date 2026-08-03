'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { User, LogOut, Trash2, Mail, Shield, Bell, Globe, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { useScrollPreservation } from '@/components/global-state-provider';
export default function SellerSettingsPage() {
  useScrollPreservation('seller-settings');

  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.push('/');
  };

  const sectionLabel = "text-xs font-semibold text-[#666666] uppercase tracking-wide mb-2";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[#666666] mt-0.5">Account preferences</p>
      </div>

      {/* Account section */}
      <div>
        <h2 className={sectionLabel}>Account</h2>
        <div className="divide-y divide-white/5 border-y border-[#E5E5E5] bg-[#F5F5F5]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-[#666666]" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-[#666666] uppercase tracking-wide">Signed in as</div>
              <div className="font-semibold text-black text-sm">{user?.email || 'Unknown'}</div>
            </div>
          </div>

          <button
            onClick={() => router.push('/profile')}
            className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5F5F5] transition-colors"
          >
            <User className="w-5 h-5 text-black shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Edit buyer profile</div>
              <div className="text-xs text-[#666666]">Update name, phone, address</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#666666]" />
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
          >
            <LogOut className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm text-red-400">{loggingOut ? 'Signing out…' : 'Sign out'}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h2 className={sectionLabel}>Notifications</h2>
        <div className="divide-y divide-white/5 border-y border-[#E5E5E5] bg-[#F5F5F5]">
          {[
            { label: 'New orders', desc: 'Get notified when a customer places an order', defaultOn: true },
            { label: 'Low stock', desc: 'Alert me when a product is running low', defaultOn: true },
            { label: 'Live stream reminders', desc: 'Notify followers before you go live', defaultOn: false },
            { label: 'Weekly digest', desc: 'Summary of your store performance every Monday', defaultOn: true },
          ].map((item) => (
            <ToggleRow key={item.label} label={item.label} desc={item.desc} defaultOn={item.defaultOn} />
          ))}
        </div>
      </div>

      {/* Region / Language */}
      <div>
        <h2 className={sectionLabel}>Region</h2>
        <div className="divide-y divide-white/5 border-y border-[#E5E5E5] bg-[#F5F5F5]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Globe className="w-5 h-5 text-[#666666] shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Currency</div>
              <div className="text-xs text-[#666666]">Nigerian Naira (₦)</div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Globe className="w-5 h-5 text-[#666666] shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Language</div>
              <div className="text-xs text-[#666666]">English</div>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div>
        <h2 className={sectionLabel}>Security</h2>
        <div className="divide-y divide-white/5 border-y border-[#E5E5E5] bg-[#F5F5F5]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Shield className="w-5 h-5 text-[#666666] shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm">Account Security</div>
              <div className="text-xs text-[#666666]">HTTP-only cookie auth · 30-day session</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <h2 className={sectionLabel}>Danger zone</h2>
        <div className="divide-y divide-white/5 border-y border-[#E5E5E5] bg-[#F5F5F5]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm text-red-400">Delete account</div>
              <div className="text-xs text-[#666666]">Permanent. Contact support to proceed.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, defaultOn }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-[#666666] mt-0.5">{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
          on ? 'bg-[#D4AF37]' : 'bg-[#F5F5F5]'
        }`}
        aria-pressed={on}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#F5F5F5] shadow transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

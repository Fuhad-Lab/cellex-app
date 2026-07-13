'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, LogOut, Trash2, Mail, Shield, Bell, Globe } from 'lucide-react';
import { useState } from 'react';

export default function SellerSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.push('/');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Account preferences</p>
      </div>

      {/* Account section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <User className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Account</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Mail className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Signed in as</div>
            <div className="font-semibold text-slate-900 text-sm">{user?.email || 'Unknown'}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/profile')}
            className="gap-2"
          >
            <User className="w-4 h-4" /> Edit buyer profile
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </Card>

      {/* Preferences (placeholder toggles) */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Bell className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Notifications</h2>
        </div>

        {[
          { label: 'New orders', desc: 'Get notified when a customer places an order', defaultOn: true },
          { label: 'Low stock', desc: 'Alert me when a product is running low', defaultOn: true },
          { label: 'Live stream reminders', desc: 'Notify followers before you go live', defaultOn: false },
          { label: 'Weekly digest', desc: 'Summary of your store performance every Monday', defaultOn: true },
        ].map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">{item.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
            </div>
            <Toggle defaultOn={item.defaultOn} />
          </div>
        ))}
      </Card>

      {/* Region / Language */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Globe className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Region</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</div>
            <div className="font-medium text-slate-900">Nigerian Naira (₦)</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Language</div>
            <div className="font-medium text-slate-900">English</div>
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Shield className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Security</h2>
        </div>
        <div className="text-sm text-slate-600">
          Your account is protected with HTTP-only cookie authentication. Sessions expire automatically
          after 30 days of inactivity. To reset your password, use the &quot;Forgot password&quot; link
          on the login page.
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="p-5 space-y-4 border-red-200">
        <div className="flex items-center gap-2 pb-2 border-b border-red-100">
          <Trash2 className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-red-600">Danger zone</h2>
        </div>
        <p className="text-sm text-slate-600">
          Need to delete your seller account? This action is permanent and cannot be undone.
          All your products, orders, and store data will be permanently removed.
        </p>
        <Button variant="destructive" disabled className="gap-2 opacity-50 cursor-not-allowed">
          <Trash2 className="w-4 h-4" /> Delete account
        </Button>
        <p className="text-xs text-slate-400">
          Account deletion requires verification. Please contact support to proceed.
        </p>
      </Card>
    </div>
  );
}

function Toggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
        on ? 'bg-black' : 'bg-slate-200'
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

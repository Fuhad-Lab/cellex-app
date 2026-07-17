'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, Package, Heart, Store, LogOut, Link2, Send, ChevronRight,
  Mail, Phone, MapPin, Settings,
  Shield, HelpCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/profile');
      return;
    }
    if (user) {
      (async () => {
        const [profileResp, ordersResp, wishResp] = await Promise.all([
          api.profile.get(),
          api.orders.list(),
          api.wishlist.get(),
        ]);
        if (profileResp.success && profileResp.profile) {
          setProfile(profileResp.profile);
          setFullName(profileResp.profile.full_name || '');
          setPhone(profileResp.profile.phone || '');
          setAddress(profileResp.profile.address || '');
        }
        if (ordersResp.success) setOrdersCount(ordersResp.orders?.length || 0);
        if (wishResp.success) setWishlistCount(wishResp.items?.length || 0);

        // Check if user is already a seller
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

  const saveProfile = async () => {
    setSaving(true);
    const result = await api.profile.update({ fullName, phone, address });
    setSaving(false);
    if (result.success) {
      setProfile({ ...profile, full_name: fullName, phone, address });
      setEditing(false);
      toast({ title: 'Profile updated' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading) { return <PageSkeleton variant="profile" />; }

  const menuItems = [
    { href: '/orders', icon: Package, label: 'My Orders', sub: `${ordersCount} order(s)` },
    { href: '/wishlist', icon: Heart, label: 'Wishlist', sub: `${wishlistCount} item(s)` },
    ...(isSeller
      ? [{ href: '/seller', icon: Store, label: 'Seller Dashboard', sub: 'Manage your store' }]
      : [{ href: '/become-seller', icon: Store, label: 'Become a Seller', sub: 'Start selling on Cellex' }]
    ),
    { href: '/link-account', icon: Link2, label: 'Link WhatsApp', sub: 'Shop via WhatsApp' },
    { href: '/telegram', icon: Send, label: 'Telegram Alerts', sub: 'Get deals on Telegram' },
  ];

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400 outline-none";

  return (
    <div className="ig-container bg-white min-h-screen pb-24">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">My Account</h1>
        <Link href="/settings" className="ig-icon-btn" aria-label="Settings">
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      {/* IG-style profile header */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center text-white font-bold text-2xl shrink-0 overflow-hidden">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.email || '?').charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-semibold text-base">{ordersCount}</div>
              <div className="text-xs text-neutral-500">Orders</div>
            </div>
            <div>
              <div className="font-semibold text-base">{wishlistCount}</div>
              <div className="text-xs text-neutral-500">Wishlist</div>
            </div>
            <div>
              <div className="font-semibold text-base">{isSeller ? 'Yes' : 'No'}</div>
              <div className="text-xs text-neutral-500">Seller</div>
            </div>
          </div>
        </div>

        {/* Name + email */}
        <div className="mt-4">
          <div className="font-semibold text-sm flex items-center gap-1.5">
            {fullName || user?.email?.split('@')[0]}
            {isSeller && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-black text-white px-1.5 py-0.5 rounded-full">
                <Store className="w-2.5 h-2.5" /> SELLER
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">{user?.email}</div>
          {(phone || address) && !editing && (
            <div className="mt-2 space-y-1 text-xs text-neutral-600">
              {phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-neutral-400" /> {phone}
                </div>
              )}
              {address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-neutral-400" /> {address}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit button */}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="w-full mt-4 bg-neutral-50 border border-neutral-200 text-black font-semibold rounded-md py-2 text-sm hover:bg-neutral-100"
          >
            Edit profile
          </button>
        )}

        {/* Edit form */}
        {editing && (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">Default shipping address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House, street, area, city" className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving} className="flex-1 bg-black text-white font-semibold rounded-md py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-white border border-neutral-200 text-black font-semibold rounded-md py-2.5 text-sm hover:bg-neutral-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu items — IG settings style */}
      <div className="divide-y divide-neutral-100 border-t border-neutral-100">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors"
            >
              <Icon className="w-5 h-5 text-black shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-neutral-500 truncate">{item.sub}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <div className="px-4 mt-6">
        <button onClick={handleLogout} className="w-full text-[#ed4956] border border-neutral-200 hover:bg-neutral-50 rounded-md py-2.5 text-sm font-semibold">
          <LogOut className="w-4 h-4 inline mr-2" /> Logout
        </button>
      </div>

      <div className="text-center text-[10px] text-neutral-400 pt-4">
        Cellex · Nigeria's #1 social marketplace
      </div>
    </div>
  );
}

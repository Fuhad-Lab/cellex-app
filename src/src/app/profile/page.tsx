'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  User, Package, Heart, Store, LogOut, Link2, Send, ChevronRight, Mail, Phone, MapPin
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const menuItems = [
    { href: '/orders', icon: Package, label: 'My Orders', sub: `${ordersCount} order(s)`, color: 'bg-blue-100 text-blue-600' },
    { href: '/wishlist', icon: Heart, label: 'Wishlist', sub: `${wishlistCount} item(s)`, color: 'bg-red-100 text-red-600' },
    { href: '/seller', icon: Store, label: 'Seller Dashboard', sub: 'Manage your store', color: 'bg-green-100 text-green-600' },
    { href: '/link-account', icon: Link2, label: 'Link WhatsApp', sub: 'Shop via WhatsApp', color: 'bg-emerald-100 text-emerald-600' },
    { href: '/telegram', icon: Send, label: 'Telegram Alerts', sub: 'Get deals on Telegram', color: 'bg-cyan-100 text-cyan-600' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-4">
      <h1 className="text-xl font-bold">My Account</h1>

      {/* User card */}
      <Card className="p-4 border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xl">
            {(user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{fullName || user?.email?.split('@')[0]}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default shipping address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House, street, area, city" />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveProfile} disabled={saving} className="brand-gradient text-primary-foreground flex-1">
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{user?.email}</span>
            </div>
            {phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{phone}</span>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{address}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Quick menu */}
      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-3 border-slate-100 hover:shadow-md transition-shadow flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.sub}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Card>
            </Link>
          );
        })}
      </div>

      <Button onClick={handleLogout} variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50">
        <LogOut className="w-4 h-4 mr-2" /> Logout
      </Button>

      <div className="text-center text-[10px] text-slate-400 pt-2">
        Cellex · Nigeria's #1 social marketplace
      </div>
    </div>
  );
}

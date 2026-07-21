'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  User, Package, Heart, Store, LogOut, Link2, Send, ChevronRight,
  ChevronLeft, Mail, Phone, MapPin, Settings as SettingsIcon,
  Shield, HelpCircle, Bell, Globe, CreditCard, Truck, Wallet,
  Bookmark, ShoppingBag, Star, Clapperboard, FileText, LogIn,
  CheckCircle, ArrowRight, Eye, Heart as HeartIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { formatPrice, timeAgo } from '@/lib/api';

/**
 * ProfilePage — multi-section account hub with client-side view switching.
 *
 * Inspired by Instagram + Amazon account pages:
 * - Profile header (avatar, name, stats)
 * - Tab bar: Overview | Orders | Settings
 * - Each tab shows different content within the same page (no page reload)
 * - URL hash (#orders, #settings) is synced so users can bookmark/share
 *
 * Sections:
 * - Overview: quick stats + recent orders + quick links
 * - Orders: full order history (inline, not a separate page)
 * - Settings: profile edit form + notification prefs + region + security
 *
 * For sellers, an extra "Store" tab appears that links to /seller-dashboard.
 */

type View = 'overview' | 'orders' | 'settings' | 'store';

export default function ProfilePage() {
  const { user, loading: authLoading, logout, isSeller } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [view, setView] = useState<View>('overview');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Notification preferences (local state — would be saved to backend in production)
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifPromos, setNotifPromos] = useState(true);
  const [notifLive, setNotifLive] = useState(false);

  // Read initial view from URL hash (#orders, #settings, #store)
  useEffect(() => {
    const hash = window.location.hash.slice(1) as View;
    if (['overview', 'orders', 'settings', 'store'].includes(hash)) {
      setView(hash);
    }
  }, []);

  // Update URL hash when view changes
  useEffect(() => {
    window.location.hash = view;
  }, [view]);

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
        if (ordersResp.success) setOrders(ordersResp.orders || []);
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

  if (authLoading) { return <PageSkeleton variant="profile" />; }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm focus:bg-white/10 focus:border-white/10 outline-none";

  // Show "Store" tab only for sellers
  const tabs: { key: View; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];
  if (isSeller) {
    tabs.splice(2, 0, { key: 'store', label: 'Store', icon: Store });
  }

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">My Account</h1>
      </div>

      {/* Profile header — IG-style */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shrink-0 overflow-hidden">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.email || '?').charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-semibold text-base">{orders.length}</div>
              <div className="text-xs text-slate-400">Orders</div>
            </div>
            <div>
              <div className="font-semibold text-base">{wishlistCount}</div>
              <div className="text-xs text-slate-400">Wishlist</div>
            </div>
            <div>
              <div className="font-semibold text-base">{isSeller ? 'Yes' : 'No'}</div>
              <div className="text-xs text-slate-400">Seller</div>
            </div>
          </div>
        </div>

        {/* Name + email */}
        <div className="mt-4">
          <div className="font-semibold text-sm flex items-center gap-1.5">
            {fullName || user?.email?.split('@')[0]}
            {isSeller && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                <Store className="w-2.5 h-2.5" /> SELLER
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">{user?.email}</div>
        </div>

        {/* Quick action button */}
        <button
          onClick={() => setView('settings')}
          className="w-full mt-4 bg-white/5 border border-white/10 text-white font-semibold rounded-md py-2 text-sm hover:bg-white/5"
        >
          Edit profile
        </button>
      </div>

      {/* Tab bar — IG-style */}
      <div className="ig-tab-bar sticky top-[54px] z-20 bg-white/10">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`ig-tab ${view === t.key ? 'active' : ''}`}
              aria-label={t.label}
            >
              <Icon className="w-5 h-5" strokeWidth={view === t.key ? 2.5 : 1.5} />
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW VIEW ===== */}
      {view === 'overview' && (
        <div className="animate-fade-in">
          {/* Quick links grid — Amazon account style */}
          <div className="grid grid-cols-3 gap-2 p-4 border-b border-white/5">
            {[
              { icon: Package, label: 'Orders', sub: `${orders.length}`, view: 'orders' as View },
              { icon: Heart, label: 'Wishlist', sub: `${wishlistCount}`, href: '/wishlist' },
              { icon: ShoppingBag, label: 'Cart', sub: '', href: '/cart' },
              { icon: Clapperboard, label: 'Shorts', sub: '', href: '/shorts' },
              { icon: Link2, label: 'WhatsApp', sub: '', href: '/link-account' },
              { icon: Send, label: 'Telegram', sub: '', href: '/telegram' },
            ].map((item, i) => {
              const Icon = item.icon;
              const content = (
                <>
                  <Icon className="w-5 h-5 text-white mb-1.5" strokeWidth={1.5} />
                  <div className="text-[11px] font-semibold text-white">{item.label}</div>
                  {item.sub && <div className="text-[10px] text-slate-400">{item.sub}</div>}
                </>
              );
              return item.href ? (
                <Link
                  key={i}
                  href={item.href}
                  className="flex flex-col items-center justify-center p-3 border border-white/10 rounded-md hover:bg-white/5 transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={i}
                  onClick={() => item.view && setView(item.view)}
                  className="flex flex-col items-center justify-center p-3 border border-white/10 rounded-md hover:bg-white/5 transition-colors"
                >
                  {content}
                </button>
              );
            })}
          </div>

          {/* Recent orders */}
          <div className="px-4 py-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Recent Orders</h3>
              <button onClick={() => setView('orders')} className="text-xs font-semibold text-sky-500">
                See all
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">No orders yet</p>
                <Link href="/categories" className="inline-block mt-2 text-xs font-semibold text-sky-500">
                  Start shopping
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="flex items-center gap-3 p-2 border border-white/5 rounded-md">
                    <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">
                        Order #{String(order.id).slice(-6)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {order.items?.length || 0} item(s) · {formatPrice(order.total || 0)}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 bg-white/5 rounded-full">
                      {order.status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Become a seller CTA (only for non-sellers) */}
          {!isSeller && (
            <Link
              href="/become-seller"
              className="block mx-4 my-4 bg-indigo-600 text-white rounded-xl p-4 flex items-center gap-3 hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Become a Seller</div>
                <div className="text-xs text-white/70">Start selling on Cellex today</div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* ===== ORDERS VIEW ===== */}
      {view === 'orders' && (
        <div className="animate-fade-in">
          {orders.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-300">No orders yet</p>
              <p className="text-xs text-slate-500 mt-1">When you place orders, they'll appear here.</p>
              <Link href="/categories" className="inline-block mt-4 bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 rounded-md">
                Start shopping
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {orders.map((order) => (
                <div key={order.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold">Order #{String(order.id).slice(-6)}</div>
                      <div className="text-[10px] text-slate-400">
                        {order.created_at ? timeAgo(order.created_at) : ''} · {formatPrice(order.total || 0)}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 bg-white/5 rounded-full text-slate-300">
                      {order.status || 'pending'}
                    </span>
                  </div>
                  {/* Order items */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {(order.items || []).slice(0, 4).map((item: any, i: number) => (
                      <div key={i} className="w-12 h-12 rounded bg-white/5 overflow-hidden shrink-0">
                        {item.product?.image_url || item.image_url ? (
                          <img src={item.product?.image_url || item.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-slate-600" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== STORE VIEW (sellers only) ===== */}
      {view === 'store' && isSeller && (
        <div className="animate-fade-in px-4 py-4 space-y-3">
          <Link
            href="/seller-dashboard"
            className="block bg-indigo-600 text-white rounded-xl p-4 flex items-center gap-3 hover:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Seller Dashboard</div>
              <div className="text-xs text-white/70">Manage products, orders, videos</div>
            </div>
            <ChevronRight className="w-5 h-5" />
          </Link>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Package, label: 'Products', href: '/seller/products' },
              { icon: ShoppingBag, label: 'Orders', href: '/seller/orders' },
              { icon: Clapperboard, label: 'Videos & Reels', href: '/seller/videos' },
              { icon: Store, label: 'Store Profile', href: '/seller/profile' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <Link
                  key={i}
                  href={item.href}
                  className="flex flex-col items-start p-3 border border-white/10 rounded-md hover:bg-white/5 transition-colors"
                >
                  <Icon className="w-5 h-5 text-white mb-2" strokeWidth={1.5} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== SETTINGS VIEW ===== */}
      {view === 'settings' && (
        <div className="animate-fade-in">
          {/* Profile edit section */}
          <div className="px-4 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold mb-3">Profile</h3>

            {!editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">{fullName || 'Not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">{user?.email}</span>
                </div>
                {phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{phone}</span>
                  </div>
                )}
                {address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                    <span className="text-slate-300">{address}</span>
                  </div>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="w-full mt-2 bg-white/5 border border-white/10 text-white font-semibold rounded-md py-2 text-sm hover:bg-white/5"
                >
                  Edit profile
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Default shipping address</Label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House, street, area, city" className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveProfile} disabled={saving} className="flex-1 bg-indigo-600 text-white font-semibold rounded-md py-2.5 text-sm hover:bg-white/10 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="flex-1 bg-white/10 border border-white/10 text-white font-semibold rounded-md py-2.5 text-sm hover:bg-white/5">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notification preferences */}
          <div className="px-4 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Order updates', sub: 'Get notified about your order status', state: notifOrders, set: setNotifOrders },
                { label: 'Promotions & deals', sub: 'Receive alerts for flash sales and discounts', state: notifPromos, set: setNotifPromos },
                { label: 'Live shopping reminders', sub: 'When sellers you follow go live', state: notifLive, set: setNotifLive },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-[11px] text-slate-400">{item.sub}</div>
                  </div>
                  <button
                    onClick={() => item.set(!item.state)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${item.state ? 'bg-indigo-600' : 'bg-white/10'}`}
                    aria-label={`Toggle ${item.label}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white/10 shadow transition-transform ${item.state ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Region */}
          <div className="px-4 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Region
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Currency</span>
                <span className="font-medium">₦ (Naira)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Language</span>
                <span className="font-medium">English</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Country</span>
                <span className="font-medium">Nigeria</span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="px-4 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Security
            </h3>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm py-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="flex-1 text-slate-300">HTTP-only cookie auth</span>
                <span className="text-[10px] text-green-600 font-semibold">ACTIVE</span>
              </div>
              <div className="flex items-center gap-2 text-sm py-2">
                <Shield className="w-4 h-4 text-slate-500" />
                <span className="flex-1 text-slate-300">Rate limiting on login</span>
                <span className="text-[10px] text-green-600 font-semibold">ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Help & support */}
          <div className="px-4 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" /> Help & Support
            </h3>
            <div className="space-y-1">
              <Link href="/ai-chat" className="flex items-center gap-2 text-sm py-2 hover:opacity-70">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span className="flex-1">Help Center</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </Link>
              <Link href="/link-account" className="flex items-center gap-2 text-sm py-2 hover:opacity-70">
                <Link2 className="w-4 h-4 text-slate-500" />
                <span className="flex-1">Link WhatsApp for support</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </Link>
            </div>
          </div>

          {/* Logout */}
          <div className="px-4 py-6">
            <button
              onClick={handleLogout}
              className="w-full text-red-400 border border-white/10 hover:bg-white/5 rounded-md py-2.5 text-sm font-semibold"
            >
              <LogOut className="w-4 h-4 inline mr-2" /> Logout
            </button>
          </div>

          <div className="text-center text-[10px] text-slate-500 pb-4">
            Cellex · Nigeria's #1 social marketplace
          </div>
        </div>
      )}
    </div>
  );
}

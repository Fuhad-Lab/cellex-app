'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MessageCircle, Store, Users, ShoppingBag, Search } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  type: 'buyer' | 'seller' | 'group_buy';
}

export default function MessengerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSeller, setIsSeller] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'buyers' | 'sellers' | 'group_buys'>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/messenger');
      return;
    }
    if (user) {
      // Check if user is a seller
      (async () => {
        try {
          const resp = await fetch('/api/seller-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.seller) {
              setIsSeller(true);
            }
          }
        } catch {}
        setLoading(false);
      })();

      // TODO: Replace with real conversations API when available
      // For now, show empty state
      setConversations([]);
      setLoading(false);
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // Role-based tabs:
  // - Buyer: All, Group buys, Sellers
  // - Buyer-Seller: All, Buyers, Sellers, Group buys
  const tabs = isSeller
    ? [
        { key: 'all', label: 'All', icon: MessageCircle },
        { key: 'buyers', label: 'Buyers', icon: ShoppingBag },
        { key: 'sellers', label: 'Sellers', icon: Store },
        { key: 'group_buys', label: 'Group Buys', icon: Users },
      ]
    : [
        { key: 'all', label: 'All', icon: MessageCircle },
        { key: 'group_buys', label: 'Group Buys', icon: Users },
        { key: 'sellers', label: 'Sellers', icon: Store },
      ];

  const filteredConversations = conversations.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'buyers') return c.type === 'buyer';
    if (activeTab === 'sellers') return c.type === 'seller';
    if (activeTab === 'group_buys') return c.type === 'group_buy';
    return true;
  });

  return (
    <div className="bg-white min-h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold flex-1">Messages</h1>
        <Link href="/ai-chat" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
          <Search className="w-5 h-5 text-slate-500" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="sticky top-[57px] z-20 bg-white border-b border-slate-100 px-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-black text-black font-bold'
                  : 'border-transparent text-slate-500 hover:text-black'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conversations list */}
      <div className="pb-24">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold mb-1">No messages yet</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-xs">
              {isSeller
                ? 'When buyers message you about your products or group buys, their conversations will appear here.'
                : 'When you message sellers about products or join group buys, your conversations will appear here.'}
            </p>
            <Link
              href="/categories"
              className="bg-black text-white text-sm font-bold px-6 py-3 rounded-full"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 relative">
                {conv.avatar ? (
                  <img src={conv.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="font-bold text-slate-500">
                    {conv.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {conv.type === 'group_buy' && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                    <Users className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm truncate">{conv.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{conv.timestamp}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 truncate">{conv.lastMessage}</span>
                  {conv.unread > 0 && (
                    <span className="bg-black text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

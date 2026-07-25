'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, MessageCircle, Store, Users, Sparkles, Send,
  Lock, ArrowLeft, Search
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { API_BASE } from '@/lib/api';

interface Conversation {
  id: string;
  type: string;
  lastMessage: string;
  lastMessageAt: string;
  otherUserId: string;
  otherUserEmail: string;
  otherUserName: string;
}

interface Message {
  id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  sender_email: string;
}

export default function MessengerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSeller, setIsSeller] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'group_buys' | 'sellers'>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ---- E2E Encryption: Generate or load AES-GCM key ----
  useEffect(() => {
    async function initCrypto() {
      // Try to load existing key from localStorage
      const storedKey = localStorage.getItem('cellex_chat_key');
      if (storedKey) {
        try {
          const rawKey = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
          const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
          setCryptoKey(key);
          return;
        } catch {}
      }
      // Generate new key
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const rawKey = await crypto.subtle.exportKey('raw', key);
      const keyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      localStorage.setItem('cellex_chat_key', keyB64);
      setCryptoKey(key);
    }
    initCrypto();
  }, []);

  // ---- Auth + seller check ----
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/messenger');
      return;
    }
    if (user) {
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/seller-profile`, {
      credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.seller) setIsSeller(true);
          }
        } catch {}
        setLoading(false);
      })();

      // Load conversations
      loadConversations();
    }
  }, [user, authLoading, router]);

  const loadConversations = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/messenger`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'list' }),
      });
      const data = await resp.json();
      if (data.success) setConversations(data.conversations || []);
    } catch {}
  };

  // ---- Load messages when a conversation is selected ----
  useEffect(() => {
    if (!activeConversation) return;
    loadMessages(activeConversation.id);
  }, [activeConversation]);

  const loadMessages = async (convId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/messenger`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'messages', conversationId: convId }),
      });
      const data = await resp.json();
      if (data.success) setMessages(data.messages || []);
    } catch {}
  };

  // ---- Decrypt a message ----
  const decryptMessage = async (encryptedContent: string, iv: string): Promise<string> => {
    if (!cryptoKey) return '[Decrypting...]';
    try {
      const encData = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
      const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivData }, cryptoKey, encData);
      return new TextDecoder().decode(decrypted);
    } catch {
      return '[Unable to decrypt]';
    }
  };

  // ---- Encrypt and send a message ----
  const sendMessage = async () => {
    if (!inputText.trim() || !activeConversation || !cryptoKey || sending) return;
    setSending(true);
    try {
      // Encrypt the message
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(inputText);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);

      const encryptedB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      const ivB64 = btoa(String.fromCharCode(...iv));

      const resp = await fetch(`${API_BASE}/api/messenger`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'send',
          conversationId: activeConversation.id,
          encryptedContent: encryptedB64,
          iv: ivB64,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setMessages(prev => [...prev, {
          ...data.message,
          sender_email: user?.email || '',
        }]);
        setInputText('');
      }
    } catch {}
    setSending(false);
  };

  // ---- Decrypt messages for display ----
  const [decryptedMessages, setDecryptedMessages] = useState<{ id: string; text: string; sender_id: string; created_at: string }[]>([]);
  useEffect(() => {
    async function decryptAll() {
      if (!cryptoKey || messages.length === 0) {
        setDecryptedMessages([]);
        return;
      }
      const decrypted = await Promise.all(
        messages.map(async (m) => ({
          id: m.id,
          text: await decryptMessage(m.encrypted_content, m.iv),
          sender_id: m.sender_id,
          created_at: m.created_at,
        }))
      );
      setDecryptedMessages(decrypted);
    }
    decryptAll();
  }, [messages, cryptoKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  // ---- Filter conversations by tab ----
  const filteredConversations = conversations.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'group_buys') return c.type === 'group_buy';
    if (activeTab === 'sellers') return c.type === 'seller';
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#E5E5E5] border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: 'all', label: 'All', icon: MessageCircle },
    { key: 'group_buys', label: 'Group Buys', icon: Users },
    { key: 'sellers', label: 'Sellers', icon: Store },
  ];

  // ---- Chat view (when a conversation is active) ----
  if (activeConversation) {
    return (
      <div className="ig-container min-h-screen flex flex-col h-screen" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Chat header */}
        <div className="flex items-center px-3 py-3 border-b border-[#E5E5E5] shrink-0">
          <button onClick={() => setActiveConversation(null)} className="ig-icon-btn" aria-label="Back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 ml-1">
            <div className="font-semibold text-sm">{activeConversation.otherUserName || activeConversation.otherUserEmail}</div>
            <div className="flex items-center gap-1 text-[10px] text-green-600">
              <Lock className="w-2.5 h-2.5" /> End-to-end encrypted
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {decryptedMessages.length === 0 && (
            <div className="text-center py-12">
              <Lock className="w-10 h-10 mx-auto text-[#666666] mb-2" />
              <p className="text-sm text-[#666666]">Messages are end-to-end encrypted. Start the conversation.</p>
            </div>
          )}
          {decryptedMessages.map((m) => {
            const isMe = m.sender_id === user?.id || m.sender_id === user?.email;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMe ? 'bg-[#D4AF37] text-black rounded-br-md' : 'bg-[#F5F5F5] text-black rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`text-[9px] mt-1 ${isMe ? 'text-black/60' : 'text-[#666666]'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-[#E5E5E5] px-4 py-3 flex items-center gap-2 bg-[#F5F5F5]">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-[#F5F5F5] rounded-full px-4 py-2.5 text-sm outline-none focus:bg-[#F5F5F5] focus:ring-1 focus:ring-white/20"
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center disabled:opacity-30 shrink-0"
            aria-label="Send"
          >
            <Send className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    );
  }

  // ---- Conversation list view ----
  return (
    <div className="ig-container min-h-screen" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Header */}
      <div className="flex items-center px-3 py-3 border-b border-[#E5E5E5] shrink-0">
        <button onClick={() => router.push('/')} className="ig-icon-btn shrink-0" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-1">Messages</h1>
        <Link href="/ai-chat" className="ig-icon-btn shrink-0" aria-label="AI Assistant" title="AI Assistant">
          <Sparkles className="w-6 h-6" />
        </Link>
      </div>

      {/* AI Assistant widget */}
      <Link href="/ai-chat" className="mx-4 mt-3 block bg-[#D4AF37] rounded-md p-4 flex items-center gap-3 hover:bg-[#F5F5F5] transition-colors">
        <div className="w-11 h-11 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-black" />
        </div>
        <div className="flex-1 text-black">
          <div className="font-semibold text-sm">AI Shopping Assistant</div>
          <div className="text-[10px] opacity-90">Find products, get recommendations, ask questions</div>
        </div>
        <ChevronLeft className="w-5 h-5 text-black rotate-180" />
      </Link>

      {/* Encryption badge */}
      <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-[#666666]">
        <Lock className="w-3 h-3" />
        <span>All messages are end-to-end encrypted</span>
      </div>

      {/* Tabs */}
      <div className="sticky top-[54px] z-20 bg-[#F5F5F5] border-b border-[#E5E5E5] px-2 flex items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive ? 'border-[#E5E5E5] text-black font-semibold' : 'border-transparent text-[#666666] hover:text-black'
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
            <div className="w-16 h-16 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#666666]" />
            </div>
            <h2 className="text-base font-semibold mb-1">No messages yet</h2>
            <p className="text-sm text-[#666666] mb-6 max-w-xs">
              {isSeller
                ? 'When buyers message you about products or group buys, conversations will appear here.'
                : 'Message sellers about products, join group buys, or ask questions. Your messages are encrypted.'}
            </p>
            <Link href="/categories" className="bg-[#D4AF37] text-black text-sm font-semibold px-6 py-3 rounded-md">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F5] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0 relative">
                  <span className="font-semibold text-[#666666] text-sm">
                    {(conv.otherUserName || conv.otherUserEmail || '?').charAt(0).toUpperCase()}
                  </span>
                  {conv.type === 'group_buy' && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center">
                      <Users className="w-3 h-3 text-black" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{conv.otherUserName || conv.otherUserEmail}</div>
                  <div className="text-xs text-[#666666] truncate">{conv.lastMessage || 'Tap to start chatting'}</div>
                </div>
                {conv.lastMessageAt && (
                  <span className="text-[10px] text-[#666666] shrink-0">
                    {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

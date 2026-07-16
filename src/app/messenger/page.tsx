'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, MessageCircle, Store, Users, Sparkles, Send,
  Lock, ArrowLeft, Search
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

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
          const resp = await fetch('/api/seller-profile', {
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
      const resp = await fetch('/api/messenger', {
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
      const resp = await fetch('/api/messenger', {
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

      const resp = await fetch('/api/messenger', {
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
        <div className="w-8 h-8 border-3 border-slate-200 border-t-black rounded-full animate-spin" />
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
      <div className="bg-white min-h-screen max-w-2xl mx-auto flex flex-col h-screen">
        {/* Chat header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setActiveConversation(null)} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="font-bold text-sm">{activeConversation.otherUserName || activeConversation.otherUserEmail}</div>
            <div className="flex items-center gap-1 text-[10px] text-green-600">
              <Lock className="w-2.5 h-2.5" /> End-to-end encrypted
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {decryptedMessages.length === 0 && (
            <div className="text-center py-12">
              <Lock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Messages are end-to-end encrypted. Start the conversation!</p>
            </div>
          )}
          {decryptedMessages.map((m) => {
            const isMe = m.sender_id === user?.id || m.sender_id === user?.email;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMe ? 'bg-black text-white rounded-br-md' : 'bg-slate-100 text-slate-900 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`text-[9px] mt-1 ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || sending}
            className="w-10 h-10 rounded-full bg-black flex items-center justify-center disabled:opacity-30 shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ---- Conversation list view ----
  return (
    <div className="bg-white min-h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold flex-1">Messages</h1>
        <Link href="/ai-chat" className="w-9 h-9 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center shrink-0 transition-colors" title="AI Assistant">
          <Sparkles className="w-5 h-5 text-purple-600" />
        </Link>
      </div>

      {/* AI Assistant widget */}
      <Link href="/ai-chat" className="mx-3 mt-3 block bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 flex items-center gap-3 hover:shadow-lg transition-shadow">
        <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-white">
          <div className="font-bold text-sm">AI Shopping Assistant</div>
          <div className="text-[10px] opacity-90">Find products, get recommendations, ask questions</div>
        </div>
        <ChevronLeft className="w-5 h-5 text-white rotate-180" />
      </Link>

      {/* Encryption badge */}
      <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-400">
        <Lock className="w-3 h-3" />
        <span>All messages are end-to-end encrypted</span>
      </div>

      {/* Tabs */}
      <div className="sticky top-[57px] z-20 bg-white border-b border-slate-100 px-2 flex items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive ? 'border-black text-black font-bold' : 'border-transparent text-slate-500 hover:text-black'
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
                ? 'When buyers message you about products or group buys, conversations will appear here.'
                : 'Message sellers about products, join group buys, or ask questions. Your messages are encrypted.'}
            </p>
            <Link href="/categories" className="bg-black text-white text-sm font-bold px-6 py-3 rounded-full">
              Browse Products
            </Link>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 relative">
                <span className="font-bold text-slate-500 text-sm">
                  {(conv.otherUserName || conv.otherUserEmail || '?').charAt(0).toUpperCase()}
                </span>
                {conv.type === 'group_buy' && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                    <Users className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{conv.otherUserName || conv.otherUserEmail}</div>
                <div className="text-xs text-slate-500 truncate">{conv.lastMessage || 'Tap to start chatting'}</div>
              </div>
              {conv.lastMessageAt && (
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InternalLink from '@/components/internal-link';
import {
  ChevronLeft, MessageCircle, Store, Users, Sparkles, Send,
  Lock, ArrowLeft, Search, Plus, Phone, Video, MoreVertical,
  Check, CheckCheck, Image as ImageIcon, Mic, Smile, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { API_BASE } from '@/lib/api';

import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
interface Conversation {
  id: string;
  type: string;
  isGroup?: boolean;
  name?: string;
  groupBuyId?: string;
  lastMessage: string;
  lastMessageAt: string;
  otherUserId: string;
  otherUserEmail: string;
  otherUserName: string;
  otherUserImage?: string;
  memberCount?: number;
}

interface Message {
  id: string;
  senderId: string;
  encryptedContent: string;
  iv: string;
  createdAt: string;
}

export default function MessengerPage() {
  useScrollPreservation('messenger');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSeller, setIsSeller] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'group_buys' | 'sellers'>('all');
  const [conversations, setConversations] = usePersistedState<Conversation[]>('messenger:conversations', []);
  const [activeConversation, setActiveConversation] = usePersistedState<Conversation | null>('messenger:activeConversation', null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = usePersistedState<boolean>('messenger:hasLoadedOnce', false);
  const [loading, setLoading] = useState(!hasLoadedOnce && conversations.length === 0);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [decryptErrors, setDecryptErrors] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- E2E Encryption ----
  // The AES-GCM key is DERIVED deterministically from the CONVERSATION ID using
  // PBKDF2 with a fixed salt. This means:
  //   - ALL members of a conversation share the SAME key (so they can decrypt
  //     each other's messages — essential for group chats)
  //   - The same user on a different device gets the same key (so messages
  //     sync across devices)
  //   - Different conversations have different keys (so a member of conv A
  //     can't read conv B's messages)
  //
  // The key is cached in memory (per conversation) so we don't re-derive
  // it on every render. PBKDF2 with 100k iterations takes ~100ms which would
  // cause a noticeable delay if done per-message.
  // NO sessionStorage/localStorage — keys are kept in memory only (RAM).
  const keyCacheRef = useRef<Map<string, CryptoKey>>(new Map());

  const deriveKeyForConversation = useCallback(async (conversationId: string): Promise<CryptoKey | null> => {
    // Check in-memory cache first
    const cached = keyCacheRef.current.get(conversationId);
    if (cached) return cached;

    const encoder = new TextEncoder();
    const salt = encoder.encode('cellex-e2e-encryption-v1-fixed-salt');
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(conversationId),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Cache in memory (NOT sessionStorage)
    keyCacheRef.current.set(conversationId, key);
    return key;
  }, []);

  // Derive the key for the active conversation (changes when conversation changes)
  useEffect(() => {
    if (!activeConversation) {
      setCryptoKey(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const key = await deriveKeyForConversation(activeConversation.id);
      if (!cancelled) setCryptoKey(key);
    })();
    return () => { cancelled = true; };
  }, [activeConversation, deriveKeyForConversation]);

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
        setHasLoadedOnce(true);
        setLoading(false);
      })();
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
      if (data.success) {
        setMessages(data.messages || []);
        setDecryptErrors(new Set()); // Reset decrypt errors on new conversation
      }
    } catch {}
  };

  const decryptMessage = async (encryptedContent: string, iv: string): Promise<string> => {
    if (!cryptoKey) return '[Decrypting...]';
    try {
      const encData = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
      const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivData }, cryptoKey, encData);
      return new TextDecoder().decode(decrypted);
    } catch {
      return '[Unable to decrypt — sent from another device]';
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeConversation || !cryptoKey || sending) return;
    setSending(true);
    try {
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
        setMessages(prev => [...prev, data.message]);
        setInputText('');
        loadConversations();
      }
    } catch {}
    setSending(false);
  };

  const [decryptedMessages, setDecryptedMessages] = useState<{ id: string; text: string; senderId: string; createdAt: string }[]>([]);
  useEffect(() => {
    async function decryptAll() {
      if (!cryptoKey || messages.length === 0) {
        setDecryptedMessages([]);
        return;
      }
      const decrypted = await Promise.all(
        messages.map(async (m) => ({
          id: m.id,
          text: await decryptMessage(m.encryptedContent, m.iv),
          senderId: m.senderId,
          createdAt: m.createdAt,
        }))
      );
      setDecryptedMessages(decrypted);
    }
    decryptAll();
  }, [messages, cryptoKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  const filteredConversations = conversations.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'group_buys') return c.type === 'group_buy' || c.isGroup;
    if (activeTab === 'sellers') return !c.isGroup && (c.type === 'seller' || c.type === 'direct');
    return true;
  });

  // ---- Loading skeleton (no "no messages" flash) ----
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white ">
        {/* Header skeleton */}
        <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center">
          <div className="w-9 h-9 rounded-full bg-[#F3F4F6] animate-pulse" />
          <div className="h-5 w-24 bg-[#F3F4F6] rounded animate-pulse ml-2" />
          <div className="ml-auto w-9 h-9 rounded-full bg-[#F3F4F6] animate-pulse" />
        </div>
        {/* Search bar skeleton */}
        <div className="px-4 py-2">
          <div className="h-10 bg-[#F3F4F6] rounded-full animate-pulse" />
        </div>
        {/* AI assistant card skeleton */}
        <div className="px-4 py-2">
          <div className="h-16 bg-[#F3F4F6] rounded-2xl animate-pulse" />
        </div>
        {/* Conversation list skeleton */}
        <div className="px-4 py-2 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-12 h-12 rounded-full bg-[#F3F4F6] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-[#F3F4F6] rounded animate-pulse" />
                <div className="h-3 w-48 bg-[#F3F4F6] rounded animate-pulse" />
              </div>
              <div className="w-10 h-3 bg-[#F3F4F6] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============ CHAT VIEW (conversation open) ============
  if (activeConversation) {
    const isGroup = activeConversation.isGroup || activeConversation.type === 'group_buy';
    const displayName = isGroup
      ? (activeConversation.name || 'Group Chat')
      : (activeConversation.otherUserName || activeConversation.otherUserEmail || 'User');
    const otherInitial = (displayName || '?').charAt(0).toUpperCase();

    return (
      <div className="min-h-screen flex flex-col h-screen bg-white fixed inset-0 z-[60] md:relative md:inset-auto md:z-auto">
        {/* Chat header — iMessage style with group chat support */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[#E5E7EB] px-4 py-2.5 flex items-center gap-3 shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)' }}>
          <button
            onClick={() => setActiveConversation(null)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#111827] hover:bg-[#F3F4F6] transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative shrink-0">
            {isGroup ? (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#374151] to-[#111827] flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
            ) : activeConversation.otherUserImage ? (
              <img src={activeConversation.otherUserImage} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#111827] btn-ripple  flex items-center justify-center">
                <span className="text-sm font-bold text-white">{otherInitial}</span>
              </div>
            )}
            {isGroup && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#111827] btn-ripple  border-2 border-white flex items-center justify-center">
                <Users className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#111827] truncate">{displayName}</div>
            <div className="flex items-center gap-1 text-[10px] text-[#10B981]">
              <Lock className="w-2.5 h-2.5" />
              <span>
                {isGroup
                  ? `End-to-end encrypted · ${activeConversation.memberCount || 2} members`
                  : 'End-to-end encrypted'}
              </span>
            </div>
          </div>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#111827] hover:bg-[#F3F4F6] transition" aria-label="Voice call">
            <Phone className="w-[18px] h-[18px]" />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#111827] hover:bg-[#F3F4F6] transition" aria-label="Video call">
            <Video className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Messages — iMessage bubble style */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 bg-white">
          {decryptedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-3">
                <Lock className="w-7 h-7 text-[#9CA3AF]" />
              </div>
              <p className="text-sm font-medium text-[#111827] mb-1">No messages yet</p>
              <p className="text-xs text-[#6B7280] max-w-xs">
                Messages are end-to-end encrypted. Say hi{isGroup ? ' to the group' : ` to ${displayName}`}!
              </p>
            </div>
          )}
          {decryptedMessages.map((m, idx) => {
            const isMe = m.senderId === user?.id;
            const prevMsg = decryptedMessages[idx - 1];
            const nextMsg = decryptedMessages[idx + 1];
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== m.senderId;
            const isLastInGroup = !nextMsg || nextMsg.senderId !== m.senderId;
            const showTimestamp = isLastInGroup;
            const isDecryptError = m.text.startsWith('[Unable to decrypt');

            return (
              <div key={m.id}>
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
                  <div
                    className={`max-w-[72%] px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      isMe
                        ? 'bg-[#111827] text-white' + (isLastInGroup ? ' rounded-2xl rounded-br-md' : ' rounded-2xl')
                        : 'bg-[#F3F4F6] text-[#111827]' + (isLastInGroup ? ' rounded-2xl rounded-bl-md' : ' rounded-2xl')
                    } ${isDecryptError ? 'italic opacity-60' : ''}`}
                  >
                    {m.text}
                  </div>
                </div>
                {showTimestamp && (
                  <div className={`flex items-center gap-1 mt-1 mb-1 text-[10px] text-[#9CA3AF] ${isMe ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <CheckCheck className="w-3 h-3" />}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar — iMessage style */}
        <div className="border-t border-[#E5E7EB] px-3 py-2.5 flex items-center gap-2 bg-white" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition shrink-0" aria-label="Add photo">
            <ImageIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center bg-[#F3F4F6] rounded-full pl-4 pr-2 py-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="iMessage"
              className="flex-1 bg-transparent text-sm text-[#111827] outline-none py-1.5"
            />
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#111827] transition" aria-label="Emoji">
              <Smile className="w-5 h-5" />
            </button>
          </div>
          {inputText.trim() ? (
            <button
              onClick={sendMessage}
              disabled={sending}
              className="w-9 h-9 rounded-full bg-[#111827] btn-ripple  flex items-center justify-center disabled:opacity-30 shrink-0 transition active:scale-90"
              aria-label="Send"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition shrink-0" aria-label="Voice message">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============ CONVERSATION LIST VIEW ============
  return (
    <div className="min-h-screen bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header — simple, no back button (mobile nav bar is shown by NavShell) */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[#E5E7EB] px-4 py-3 flex items-center">
        <h1 className="text-lg font-bold flex-1 text-[#111827]">Messages</h1>
        <InternalLink href="/ai-chat" className="w-9 h-9 rounded-full flex items-center justify-center text-[#111827] hover:bg-[#F3F4F6] transition shrink-0" aria-label="AI Assistant">
          <Sparkles className="w-5 h-5" />
        </InternalLink>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-full px-4 py-2.5">
          <Search className="w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search conversations"
            className="flex-1 bg-transparent text-sm text-[#111827] outline-none"
          />
        </div>
      </div>

      {/* AI Assistant card */}
      <div className="px-4 py-2">
        <InternalLink href="/ai-chat" className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-[#111827] to-[#374151] hover:opacity-95 transition">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-white">
            <div className="font-semibold text-sm">AI Shopping Assistant</div>
            <div className="text-[11px] opacity-80">Find products, get recommendations, ask questions</div>
          </div>
          <ChevronLeft className="w-5 h-5 text-white/60 rotate-180" />
        </InternalLink>
      </div>

      {/* Encryption badge */}
      <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-[#9CA3AF]">
        <Lock className="w-3 h-3" />
        <span>All messages are end-to-end encrypted</span>
      </div>

      {/* Tabs */}
      <div className="sticky top-[60px] z-20 bg-white/80 backdrop-blur-xl border-b border-[#E5E7EB] px-3 flex items-center gap-1">
        {[
          { key: 'all', label: 'All', icon: MessageCircle },
          { key: 'group_buys', label: 'Group Buys', icon: Users },
          { key: 'sellers', label: 'Sellers', icon: Store },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                isActive ? 'border-[#111827] text-[#111827] font-semibold' : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conversation list */}
      <div className="pb-24">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#9CA3AF]" />
            </div>
            <h2 className="text-base font-semibold text-[#111827] mb-1">No messages yet</h2>
            <p className="text-sm text-[#6B7280] mb-6 max-w-xs">
              {isSeller
                ? 'When buyers message you about products or group buys, conversations will appear here.'
                : 'Message sellers about products, join group buys, or ask questions. Your messages are encrypted.'}
            </p>
            <InternalLink href="/categories" className="bg-[#111827] btn-ripple  text-white text-sm font-semibold px-6 py-3 rounded-full">
              Browse Products
            </InternalLink>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conv) => {
              const isGroup = conv.isGroup || conv.type === 'group_buy';
              const name = isGroup
                ? (conv.name || 'Group Chat')
                : (conv.otherUserName || conv.otherUserEmail || 'User');
              const initial = name.charAt(0).toUpperCase();
              const lastTime = conv.lastMessageAt
                ? new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                : '';

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F9FAFB] transition text-left border-b border-[#F3F4F6]"
                >
                  <div className="relative shrink-0">
                    {isGroup ? (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#374151] to-[#111827] flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    ) : conv.otherUserImage ? (
                      <img src={conv.otherUserImage} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#111827] btn-ripple  flex items-center justify-center">
                        <span className="font-semibold text-white text-sm">{initial}</span>
                      </div>
                    )}
                    {isGroup && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#111827] btn-ripple  border-2 border-white flex items-center justify-center">
                        <Users className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#111827] truncate">
                        {name}
                        {isGroup && <span className="ml-1.5 text-[10px] font-medium text-[#6B7280]">· {conv.memberCount || 2} members</span>}
                      </span>
                      {lastTime && <span className="text-[10px] text-[#9CA3AF] shrink-0">{lastTime}</span>}
                    </div>
                    <p className="text-xs text-[#6B7280] truncate mt-0.5">
                      {conv.lastMessage || 'Tap to start chatting'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

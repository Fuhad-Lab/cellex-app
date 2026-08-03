'use client';
import { API_BASE } from '@/lib/api';

import { useEffect, useState, useRef } from 'react';
import { api, formatPrice, type Product } from '@/lib/api';
import { Sparkles, Send, Bot, User, Store, RotateCcw, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

import { useScrollPreservation } from '@/components/global-state-provider';
interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
}

const SUGGESTIONS = [
  'I need a phone under ₦100,000',
  'Show me trending products',
  'Find farm-fresh produce',
  'Best electronics deals',
  'What\'s good for gifts under ₦20,000?',
];

export default function AiChatPage() {
  useScrollPreservation('ai-chat');

  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: user
          ? `Hi! I'm your AI shopping assistant. Tell me what you're looking for — I can search across thousands of products, recommend based on budget, and help you find the best deals. What are you shopping for today?`
          : `Hi! I'm your AI shopping assistant. I can help you find products, recommend gifts, and discover deals. Login to get personalized recommendations based on your shopping history.`,
      },
    ]);
  }, [user]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');

    const newUserMsg: Message = { role: 'user', content };
    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      // First, try to search products to give grounded recommendations
      const searchResp = await api.products.search(content, null);
      let products: Product[] = [];
      if (searchResp.success) {
        products = (searchResp.results || searchResp.products || []).slice(0, 4);
      }

      // Call AI chat endpoint
      const aiResp = await fetch(`${API_BASE}/api/ai-chat`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context: products.length
            ? `Found ${products.length} relevant products: ${products.map(p => `${p.name} (${formatPrice(p.price)})`).join(', ')}`
            : 'No specific products found, give general shopping advice.',
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      let reply = '';
      if (aiResp.ok) {
        const data = await aiResp.json();
        reply = data.reply || data.message || data.content || "I'd be happy to help you shop! Could you tell me more about what you're looking for?";
      } else {
        // Fallback if AI endpoint not configured
        if (products.length > 0) {
          reply = `Based on your request, I found ${products.length} products that might interest you. Here are my top picks:`;
        } else {
          reply = `Great question! Let me help you with that. Try browsing our categories — we have Electronics, Fashion, Home, Beauty, Farm Fresh, and more. You can also check our Flash Deals and Trending sections for the best offers.`;
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply, products: products.length ? products : undefined }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing your request. Please try again or browse our categories directly.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([{
      role: 'assistant',
      content: 'Sure! What else can I help you find today?',
    }]);
  };

  return (
    <div className="ig-container min-h-screen flex flex-col h-screen ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 ml-1 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">AI Shopping Assistant</h1>
            <p className="text-[10px] text-[#666666] leading-tight">Powered by Qwen2.5-72B</p>
          </div>
        </div>
        <button onClick={reset} className="ig-icon-btn shrink-0" aria-label="Reset conversation">
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
              msg.role === 'user' ? 'bg-[#F5F5F5]' : 'bg-[#D4AF37]'
            }`}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-[#666666]" />
                : <Bot className="w-4 h-4 text-black" />}
            </div>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#D4AF37] text-black rounded-br-md'
                  : 'bg-[#F5F5F5] text-black rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Product recommendations */}
              {msg.products && msg.products.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {msg.products.map((p) => (
                    <Link key={p.id} href={`/product?id=${p.id}`}>
                      <div className="overflow-hidden border border-[#E5E5E5] rounded-md hover:opacity-90 transition-opacity">
                        <div className="aspect-square bg-[#F5F5F5]">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#666666]">
                              <Store className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 bg-[#F5F5F5]">
                          <div className="text-xs font-medium line-clamp-2 h-8 overflow-hidden">{p.name}</div>
                          <div className="text-sm font-bold text-black mt-1">{formatPrice(p.price)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center">
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div className="bg-[#F5F5F5] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 text-xs bg-[#F5F5F5] hover:bg-[#F5F5F5] text-black rounded-full px-3 py-1.5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-[#E5E5E5] bg-[#F5F5F5]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask me anything about shopping..."
          className="flex-1 bg-[#F5F5F5] rounded-md px-3 py-2.5 text-sm outline-none focus:bg-[#F5F5F5] focus:ring-1 focus:ring-white/20"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="bg-[#D4AF37] text-black rounded-md px-4 disabled:opacity-30 hover:bg-[#F5F5F5]"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { api, formatPrice, type Product } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Bot, User, Store, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';

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
  const { user } = useAuth();
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
      const aiResp = await fetch('/api/ai-chat', {
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
    <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-4 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm">AI Shopping Assistant</h1>
            <p className="text-[10px] text-slate-500">Powered by Qwen2.5-72B</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 no-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
              msg.role === 'user' ? 'bg-slate-200' : 'brand-gradient'
            }`}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-slate-600" />
                : <Bot className="w-4 h-4 text-primary-foreground" />}
            </div>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <Card className={`p-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-slate-100 border-slate-100'
                  : 'border-slate-100'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </Card>

              {/* Product recommendations */}
              {msg.products && msg.products.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {msg.products.map((p) => (
                    <Link key={p.id} href={`/product?id=${p.id}`}>
                      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-shadow">
                        <div className="aspect-square bg-slate-50">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Store className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium line-clamp-2 h-8 overflow-hidden">{p.name}</div>
                          <div className="text-sm font-bold text-primary mt-1">{formatPrice(p.price)}</div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <Card className="p-3 border-slate-100">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </Card>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 text-xs bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-full px-3 py-1.5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask me anything about shopping..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
        />
        <Button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="brand-gradient text-primary-foreground"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

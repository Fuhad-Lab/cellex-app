'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Clock, X, Command, Store } from 'lucide-react';
import { api, formatPrice, type Product } from '@/lib/api';

/**
 * Spotlight Search — premium search experience.
 * 
 * - Glassmorphic blur backdrop (eliminates visual noise)
 * - Staggered product polaroids that scale in dynamically
 * - Cmd+K / Ctrl+K keyboard shortcut (desktop)
 * - Keyboard navigation (arrow keys + enter)
 * - Recent + trending searches when empty
 * - Product image previews as user types
 */

const TRENDING = ['Smart Watch', 'Wireless Earbuds', 'Ankara Dress', 'Phone Charger', 'Football', 'Cookware Set'];
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Farm Fresh', 'Sports', 'Food', 'Toys', 'Books'];
const QUICK_ACTIONS = [
  { label: 'Flash Deals', href: '/categories?sort=flash', icon: '🔥' },
  { label: 'Trending Now', href: '/categories?sort=trending', icon: '📈' },
  { label: 'Live Shopping', href: '/live', icon: '🔴' },
  { label: 'AI Assistant', href: '/ai-chat', icon: '✨' },
];

export function SpotlightSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cellex_recent_searches');
      if (stored) setRecent(JSON.parse(stored).slice(0, 5));
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setProducts([]);
      setActiveIndex(-1);
    }
  }, [isOpen]);

  // Search products with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setProducts([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const result = await api.products.search(query, null);
      if (result.success) {
        setProducts((result.results || result.products || []).slice(0, 6));
      }
    }, 200);
  }, [query]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // Trigger open via custom event
          window.dispatchEvent(new CustomEvent('open-spotlight'));
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const saveRecent = (q: string) => {
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 5);
    setRecent(updated);
    try { localStorage.setItem('cellex_recent_searches', JSON.stringify(updated)); } catch {}
  };

  const go = (href: string, label?: string) => {
    if (label) saveRecent(label);
    onClose();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = getAllItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        go(items[activeIndex].href, items[activeIndex].label);
      } else if (query.trim()) {
        go(`/search?q=${encodeURIComponent(query.trim())}`, query.trim());
      }
    }
  };

  const getAllItems = () => {
    const items: { label: string; href: string; type: string }[] = [];
    if (!query.trim()) {
      QUICK_ACTIONS.forEach(a => items.push({ label: a.label, href: a.href, type: 'quick' }));
      TRENDING.forEach(s => items.push({ label: s, href: `/search?q=${encodeURIComponent(s)}`, type: 'trending' }));
      CATEGORIES.slice(0, 4).forEach(c => items.push({ label: c, href: `/categories?category=${c}`, type: 'category' }));
    } else {
      items.push({ label: query, href: `/search?q=${encodeURIComponent(query)}`, type: 'search' });
      CATEGORIES.forEach(c => {
        if (c.toLowerCase().includes(query.toLowerCase())) {
          items.push({ label: c, href: `/categories?category=${c}`, type: 'category' });
        }
      });
    }
    return items;
  };

  const allItems = getAllItems();
  let itemIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Glassmorphic backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Search panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pt-[8vh] px-4"
          >
            <div className="w-full max-w-2xl glass-modal rounded-3xl overflow-hidden">
              {/* Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-slate-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search for products, categories..."
                  className="flex-1 bg-transparent outline-none text-lg text-white placeholder:text-slate-500"
                />
                {query ? (
                  <button onClick={() => setQuery('')} className="shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ) : (
                  <kbd className="shrink-0 hidden sm:flex items-center gap-0.5 px-2 py-1 bg-white/5 rounded-md text-[10px] font-bold text-slate-400">
                    <Command className="w-3 h-3" /> K
                  </kbd>
                )}
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto no-scrollbar p-3">
                {/* Product polaroids (when searching) */}
                {query.trim() && products.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Products</div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {products.map((p, i) => (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
                          onClick={() => go(`/product?id=${p.id}`)}
                          className="text-left group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-white/5 mb-1 img-zoom">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <Store className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-white line-clamp-1">{p.name}</div>
                          <div className="text-xs font-bold text-white">{formatPrice(p.price)}</div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent searches (when empty) */}
                {!query.trim() && recent.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Recent</div>
                    {recent.map((r, i) => {
                      itemIndex++;
                      const isActive = activeIndex === itemIndex;
                      return (
                        <motion.button
                          key={r}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => go(`/search?q=${encodeURIComponent(r)}`, r)}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors ${
                            isActive ? 'bg-indigo-600' : 'hover:bg-white/5'
                          }`}
                        >
                          <Clock className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                          <span className={`text-sm ${isActive ? 'text-white' : 'text-slate-300'}`}>{r}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Trending / Quick actions / Categories */}
                {allItems.map((item, i) => {
                  const realIndex = query.trim() ? i + (products.length > 0 ? -products.length : 0) : i + (recent.length > 0 ? recent.length : 0);
                  const isActive = activeIndex === i;
                  const isQuick = item.type === 'quick';
                  const isTrending = item.type === 'trending';
                  const isCategory = item.type === 'category';
                  const quickAction = QUICK_ACTIONS.find(a => a.label === item.label);

                  return (
                    <motion.button
                      key={`${item.type}-${item.label}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => go(item.href, item.label)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors ${
                        isActive ? 'bg-indigo-600' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-white/10' : 'bg-white/5'
                      }`}>
                        {isQuick && quickAction?.icon ? (
                          <span className="text-sm">{quickAction.icon}</span>
                        ) : isTrending ? (
                          <TrendingUp className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        ) : isCategory ? (
                          <span className="text-sm">📂</span>
                        ) : (
                          <Search className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white'}`}>{item.label}</div>
                        <div className={`text-[10px] ${isActive ? 'text-white/60' : 'text-slate-500'}`}>
                          {isQuick ? 'Quick action' : isTrending ? 'Trending' : isCategory ? 'Category' : 'Search'}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-white/5 bg-white/5/50 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-[9px] font-bold">↑↓</kbd> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-[9px] font-bold">↵</kbd> Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-[9px] font-bold">Esc</kbd> Close
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Cellex Search</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Hook to manage spotlight open/close state + listen for Cmd+K */
export function useSpotlight() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-spotlight', handler);
    return () => window.removeEventListener('open-spotlight', handler);
  }, []);

  return { isOpen, setIsOpen };
}

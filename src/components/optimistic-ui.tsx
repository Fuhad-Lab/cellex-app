'use client';

import { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * OptimisticUI — provides instant feedback for user actions.
 * 
 * - Cart fly animation: when "Add to Cart" is clicked, a checkmark
 *   bursts with a bouncy spring animation at the click location.
 * - Like burst: when a like button is clicked, a small confetti-like
 *   burst plays.
 * 
 * Usage:
 *   const { burst } = useOptimisticUI();
 *   <button onClick={(e) => burst(e.clientX, e.clientY)}>Add to Cart</button>
 */

interface Burst {
  id: number;
  x: number;
  y: number;
  type: 'check' | 'heart';
}

const OptimisticContext = createContext<{ burst: (x: number, y: number, type?: 'check' | 'heart') => void }>({
  burst: () => {},
});

export function OptimisticUIProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  const burst = useCallback((x: number, y: number, type: 'check' | 'heart' = 'check') => {
    const id = Date.now() + Math.random();
    setBursts(prev => [...prev, { id, x, y, type }]);
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== id));
    }, 800);
  }, []);

  return (
    <OptimisticContext.Provider value={{ burst }}>
      {children}
      {/* Burst animations overlay */}
      <div className="fixed inset-0 z-[10000] pointer-events-none">
        <AnimatePresence>
          {bursts.map(b => (
            <motion.div
              key={b.id}
              initial={{ scale: 0, x: b.x - 20, y: b.y - 20, opacity: 1 }}
              animate={{ scale: [0, 1.3, 1], y: b.y - 60, opacity: [1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              className="absolute w-10 h-10 flex items-center justify-center"
            >
              {b.type === 'check' ? (
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" strokeWidth="1">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </OptimisticContext.Provider>
  );
}

export function useOptimisticUI() {
  return useContext(OptimisticContext);
}

'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  cartCount: number;
  isSeller: boolean;
  sellerChecked: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshCartCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cartCount: 0,
  isSeller: false,
  sellerChecked: false,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
  refreshCartCount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  const [sellerChecked, setSellerChecked] = useState(false);

  const refreshCartCount = useCallback(async () => {
    if (!user) {
      setCartCount(0);
      return;
    }
    try {
      const result = await api.cart.count();
      if (result.success) {
        setCartCount(result.count || 0);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.auth.session();
        if (result.success && result.user) {
          setUser(result.user);
        }
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Check seller status ONCE when user is set (not on every page load).
  // The result is cached in the AuthProvider state, so MobileNav and
  // other components can read it synchronously without flicker.
  useEffect(() => {
    if (!user) {
      setIsSeller(false);
      setSellerChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/seller-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'get' }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled && data.success && data.seller) {
            setIsSeller(true);
          }
        }
      } catch {}
      if (!cancelled) setSellerChecked(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    refreshCartCount();
  }, [user, refreshCartCount]);

  const login = async (email: string, password: string) => {
    const result = await api.auth.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const signup = async (email: string, password: string) => {
    const result = await api.auth.signup(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setCartCount(0);
    setIsSeller(false);
    setSellerChecked(true);
  };

  return (
    <AuthContext.Provider value={{ user, loading, cartCount, isSeller, sellerChecked, login, signup, logout, refreshCartCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

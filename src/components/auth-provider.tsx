'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';
import { API_BASE } from '@/lib/api';

interface User {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  cartCount: number;
  savedCount: number;
  isSeller: boolean;
  sellerChecked: boolean;
  unreadMessages: number;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshCartCount: () => Promise<void>;
  refreshSavedCount: () => Promise<void>;
  refreshUnreadMessages: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cartCount: 0,
  savedCount: 0,
  isSeller: false,
  sellerChecked: false,
  unreadMessages: 0,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
  refreshCartCount: async () => {},
  refreshSavedCount: async () => {},
  refreshUnreadMessages: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  const [sellerChecked, setSellerChecked] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

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

  // Fetch saved/wishlist count for the Saved badge in mobile nav.
  const refreshSavedCount = useCallback(async () => {
    if (!user) {
      setSavedCount(0);
      return;
    }
    try {
      const result = await api.wishlist.get();
      if (result.success) {
        setSavedCount(result.items?.length || 0);
      }
    } catch {}
  }, [user]);

  // Fetch UNREAD message count for the messenger badge.
  // Uses the messenger_unread edge function op which counts messages where
  // sender_id != user.id AND read_at IS NULL.
  // This is the REAL unread count (not total chat count).
  const refreshUnreadMessages = useCallback(async () => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/messenger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'unread' }),
      });
      const data = await resp.json();
      if (data.success) {
        setUnreadMessages(data.count || 0);
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
        const resp = await fetch(`${API_BASE}/api/seller-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'get' }),
          credentials: 'include',
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
    if (user) {
      refreshCartCount();
      refreshSavedCount();
    }
  }, [user, refreshCartCount, refreshSavedCount]);

  // Fetch unread messages when user changes (login/logout)
  useEffect(() => {
    refreshUnreadMessages();
  }, [user, refreshUnreadMessages]);

  // Poll for new messages every 60 seconds when logged in (so the badge stays fresh)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshUnreadMessages, 60000);
    return () => clearInterval(interval);
  }, [user, refreshUnreadMessages]);

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
      // Check if the signup returned a session_id (auto-login).
      // If not (email confirmation required), auto-login with the same credentials
      // to create a real session. This is necessary because Supabase's signup
      // endpoint doesn't return a session when email confirmation is enabled,
      // even with mailer_autoconfirm=true.
      if (!result.session_id) {
        const loginResult = await api.auth.login(email, password);
        if (loginResult.success && loginResult.user) {
          setUser(loginResult.user);
          return { success: true };
        }
        // If auto-login fails, still return success (account was created)
        // but the user will need to log in manually.
        setUser(result.user);
        return { success: true };
      }
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setCartCount(0);
    setSavedCount(0);
    setUnreadMessages(0);
    setIsSeller(false);
    setSellerChecked(true);
  };

  return (
    <AuthContext.Provider value={{ user, loading, cartCount, savedCount, isSeller, sellerChecked, unreadMessages, login, signup, logout, refreshCartCount, refreshSavedCount, refreshUnreadMessages }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Cellex API Client
// For web: uses relative paths (/api/) — handled by Next.js route handlers
// For Capacitor (APK/IPA): uses absolute URL from env var (never hardcoded)
// Detection: checks if running on localhost with Capacitor's native bridge

import { Capacitor } from '@capacitor/core';

// SECURITY: The API base URL is read from NEXT_PUBLIC_API_BASE env var.
// This is a PUBLIC URL (the frontend itself) — NOT a secret. It's only
// needed for Capacitor native builds where relative URLs don't work.
// The actual backend (NestJS) and Supabase edge function URLs are NEVER
// in the frontend — all API calls go through /api/* route handlers which
// proxy to the edge functions server-side.
const API_BASE = Capacitor.isNativePlatform()
  ? (process.env.NEXT_PUBLIC_API_BASE || '')
  : '';

export { Capacitor };
export { API_BASE };

// SECURITY: Streaming configuration (RTMP server, stream key, embed URL) is
// NO LONGER in the frontend. These are fetched from the server (Edge Functions)
// via the api.live.getStreamConfig() call. This prevents attackers from
// discovering the streaming server URL or stream key from the frontend bundle.

export interface Product {
  id: number;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category?: string;
  seller_id?: string;
  units_sold?: number;
  created_at?: string;
  additional_images?: string[];
  video_url?: string;
  group_buy_enabled?: boolean;
  group_buy_target_count?: number;
  group_buy_discount_pct?: number;
}

export interface Seller {
  id: string;
  business_name?: string;
  farm_name?: string;
  business_category?: string;
  business_location?: string;
  profile_image?: string;
  seller_type?: string;
  created_at?: string;
}

export interface CartItem {
  id: string;
  product_id: number;
  quantity: number;
  products?: Product;
}

export interface Review {
  id: string;
  user_id: string;
  product_id: number;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  verified_purchase?: boolean;
  helpful_count?: number;
  created_at?: string;
  reviewer_name?: string;
}

/**
 * Get the CSRF token from the cookie (set by the server on login).
 * This is the "double-submit cookie" pattern — the token is read from a
 * non-HttpOnly cookie and sent as a custom header on every POST request.
 * The server validates that the header matches the cookie.
 */
function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)cellex_csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function apiCall(path: string, body: Record<string, unknown> = {}) {
  const resp = await fetch(`${API_BASE}/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Inject CSRF token on every API call — server validates this matches
      // the cellex_csrftoken cookie. Prevents Cross-Site Request Forgery.
      'X-CSRF-Token': getCsrfToken(),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { success: false, error: data.error || 'Request failed', status: resp.status };
  }
  return data;
}

export const api = {
  // ===== Auth =====
  auth: {
    login: (email: string, password: string) =>
      apiCall('auth', { op: 'login', email, password }),
    signup: (email: string, password: string) =>
      apiCall('auth', { op: 'signup', email, password }),
    logout: () => apiCall('auth', { op: 'logout' }),
    session: () => apiCall('auth', { op: 'session' }),
  },

  // ===== Products =====
  products: {
    home: () => apiCall('products', { op: 'home' }),
    search: (query: string, maxPrice?: number | null) =>
      apiCall('products', { op: 'search', query, maxPrice }),
    category: (category: string, sort = 'newest', page = 1) =>
      apiCall('products', { op: 'category', category, sort, page }),
    byId: (id: number) => apiCall('products', { op: 'by_id', id }),
    all: (limit = 100) => apiCall('products', { op: 'all', limit }),
  },

  // ===== Cart =====
  cart: {
    get: () => apiCall('cart', { op: 'get' }),
    count: () => apiCall('cart', { op: 'count' }),
    add: (productId: number, quantity = 1) => apiCall('cart', { op: 'add', productId, quantity }),
    remove: (cartItemId: string) => apiCall('cart', { op: 'remove', cartItemId }),
    update: (cartItemId: string, quantity: number) => apiCall('cart', { op: 'update', cartItemId, quantity }),
    clear: () => apiCall('cart', { op: 'clear' }),
  },

  // ===== Wishlist =====
  wishlist: {
    get: () => apiCall('wishlist', { op: 'get' }),
    add: (productId: number) => apiCall('wishlist', { op: 'add', productId }),
    remove: (wishlistItemId: string) => apiCall('wishlist', { op: 'remove', wishlistItemId }),
  },

  // ===== Orders =====
  orders: {
    list: () => apiCall('orders', { op: 'list' }),
    details: (orderId: string) => apiCall('orders', { op: 'details', orderId }),
  },

  // ===== Checkout =====
  checkout: {
    prepare: () => apiCall('checkout', { op: 'prepare' }),
    placeOrder: (shippingAddress: Record<string, unknown>) =>
      apiCall('checkout', { op: 'place_order', shippingAddress }),
  },

  // ===== Paystack Payment =====
  paystack: {
    getBanks: () => apiCall('payment', { op: 'get_banks' }),
    initialize: (orderId: string, email?: string) =>
      apiCall('payment', { op: 'initialize', orderId, email }),
    verify: (reference: string, orderId: string) =>
      apiCall('payment', { op: 'verify', reference, orderId }),
    getEarnings: () => apiCall('payment', { op: 'get_earnings' }),
    requestPayout: () => apiCall('payment', { op: 'request_payout' }),
  },

  // ===== Reviews =====
  reviews: {
    byProduct: (productId: number) => apiCall('reviews', { op: 'by_product', productId }),
    bySeller: (sellerId: string) => apiCall('reviews', { op: 'by_seller', sellerId }),
    create: (data: { productId: number; rating: number; title?: string; comment?: string; images?: string[] }) =>
      apiCall('reviews', { op: 'create', ...data }),
    helpful: (reviewId: string) => apiCall('reviews', { op: 'helpful', reviewId }),
  },

  // ===== Social =====
  social: {
    publicProfile: (sellerId: string, viewerId?: string | null) =>
      apiCall('social', { op: 'public_profile', sellerId, viewerId }),
    sellerFeed: (sellerId: string, limit = 20) => apiCall('social', { op: 'seller_feed', sellerId, limit }),
    discover: (limit = 12) => apiCall('social', { op: 'discover', limit }),
    follow: (sellerId: string) => apiCall('social', { op: 'follow', sellerId }),
    unfollow: (sellerId: string) => apiCall('social', { op: 'unfollow', sellerId }),
    following: () => apiCall('social', { op: 'following' }),
    feed: (limit = 20, offset = 0) => apiCall('social', { op: 'feed', limit, offset }),
  },

  // ===== Group Buy =====
  groupBuy: {
    create: (productId: number, targetCount = 3, discountPct = 20) =>
      apiCall('group-buy', { op: 'create', productId, targetCount, discountPct }),
    join: (groupBuyId: string) => apiCall('group-buy', { op: 'join', groupBuyId }),
    status: (groupBuyId: string) => apiCall('group-buy', { op: 'status', groupBuyId }),
    active: (productId: number) => apiCall('group-buy', { op: 'active', productId }),
    mine: () => apiCall('group-buy', { op: 'mine' }),
    cancel: (groupBuyId: string) => apiCall('group-buy', { op: 'cancel', groupBuyId }),
  },

  // ===== Videos =====
  videos: {
    feed: (limit = 20) => apiCall('videos', { op: 'feed', limit }),
    byProduct: (productId: number) => apiCall('videos', { op: 'by_product', productId }),
    bySeller: (sellerId: string) => apiCall('videos', { op: 'by_seller', sellerId }),
    get: (videoId: number) => apiCall('videos', { op: 'get', videoId }),
    like: (videoId: number) => apiCall('videos', { op: 'like', videoId }),
    unlike: (videoId: number) => apiCall('videos', { op: 'unlike', videoId }),
  },

  // ===== Live Shopping =====
  live: {
    list: (status = 'live') => apiCall('live', { op: 'list', status }),
    get: (sessionId: string) => apiCall('live', { op: 'get', sessionId }),
    messages: (sessionId: string, afterId = 0) => apiCall('live', { op: 'messages', sessionId, afterId }),
    join: (sessionId: string, name?: string) => apiCall('live', { op: 'join', sessionId, name }),
    leave: (sessionId: string) => apiCall('live', { op: 'leave', sessionId }),
    message: (sessionId: string, message: string) => apiCall('live', { op: 'message', sessionId, message }),
    // Stream config is fetched from the server — NO hardcoded URLs/keys in frontend
    getStreamConfig: () => apiCall('live', { op: 'get_stream_config' }),
  },

  // ===== Stories =====
  stories: {
    activeBar: () => apiCall('stories', { op: 'active_bar' }),
    bySeller: (sellerId: string) => apiCall('stories', { op: 'by_seller', sellerId }),
    get: (storyId: number) => apiCall('stories', { op: 'get', storyId }),
  },

  // ===== Trending =====
  trending: {
    list: (limit = 20, hours = 24) => apiCall('trending', { op: 'list', limit, hours }),
  },

  // ===== AI Discover =====
  discover: {
    recommend: (limit = 10) => apiCall('discover', { op: 'recommend', limit }),
  },

  // ===== Cross-platform =====
  crossPlatform: {
    generateLinkCode: (phone: string) => apiCall('cross-platform', { op: 'generate_link_code', phone }),
    myPhoneLinks: () => apiCall('cross-platform', { op: 'my_phone_links' }),
    unlinkPhone: (phone: string) => apiCall('cross-platform', { op: 'unlink_phone', phone }),
  },

  // ===== Telegram =====
  telegram: {
    channelInfo: () => apiCall('telegram', { op: 'channel_info' }),
    subscribe: (chatId: string) => apiCall('telegram', { op: 'subscribe', chatId }),
    unsubscribe: (chatId: string) => apiCall('telegram', { op: 'unsubscribe', chatId }),
    recent: (limit = 10) => apiCall('telegram', { op: 'recent', limit }),
  },

  // ===== Payment =====
  payment: {
    createOrder: (data: {
      buyerName: string;
      buyerEmail: string;
      buyerPhone?: string;
      buyerBankName?: string;
      itemsSummary: string;
      itemCount: number;
      total: number;
    }) => apiCall('payment', { op: 'create_order', ...data }),
    confirmSent: (orderId: string) => apiCall('payment', { op: 'confirm_sent', orderId }),
    checkStatus: (orderId: string) => apiCall('payment', { op: 'check_status', orderId }),
  },

  // ===== Profile =====
  profile: {
    get: () => apiCall('profile', { op: 'get' }),
    update: (data: { fullName?: string; phone?: string; address?: string; profileImage?: string }) =>
      apiCall('profile', { op: 'update', ...data }),
  },

  // ===== Seller =====
  sellerDashboard: {
    stats: () => apiCall('seller-dashboard', { op: 'stats' }),
    recent: () => apiCall('seller-dashboard', { op: 'recent' }),
  },
  sellerProducts: {
    list: () => apiCall('seller-products', { op: 'list' }),
    create: (data: { name: string; price: number; description?: string; category?: string; image_url?: string }) =>
      apiCall('seller-products', { op: 'create', ...data }),
    update: (id: number, data: Record<string, unknown>) => apiCall('seller-products', { op: 'update', id, ...data }),
    delete: (id: number) => apiCall('seller-products', { op: 'delete', id }),
  },
  sellerOrders: {
    list: () => apiCall('seller-orders', { op: 'list' }),
  },

  // ===== AI Recommendations (Gorse + NVIDIA + Chroma) =====
  recommend: {
    home: (limit?: number) =>
      apiCall('recommend', { op: 'home', limit }),
    category: (category: string, limit?: number) =>
      apiCall('recommend', { op: 'category', category, limit }),
    shorts: (limit?: number) =>
      apiCall('recommend', { op: 'shorts', limit }),
    neighbors: (itemId: string | number, limit?: number) =>
      apiCall('recommend', { op: 'neighbors', itemId: String(itemId), limit }),
  },

  // ===== Smart Search (NVIDIA + Chroma) =====
  smartSearch: (query: string, limit?: number) =>
    apiCall('smart-search', { query, limit }),

  // ===== Feedback Sync (non-blocking) =====
  feedback: (itemId: string | number, type: string, score?: number, metadata?: any) =>
    apiCall('feedback', { itemId: String(itemId), type, score, metadata }),

  // ===== Comments (real, persisted to DB + fires Gorse feedback) =====
  comments: {
    list: (postType: 'video' | 'product', postId: string | number, limit = 50) =>
      apiCall('comments', { op: 'list', postType, postId, limit }),
    create: (postType: 'video' | 'product', postId: string | number, commentText: string) =>
      apiCall('comments', { op: 'create', postType, postId, commentText }),
    delete: (commentId: number) =>
      apiCall('comments', { op: 'delete', commentId }),
  },

  // ===== Notifications (real, from buyers_notifications table) =====
  notifications: {
    list: (limit = 50) => apiCall('notifications', { op: 'list', limit }),
    markRead: (notificationId: string) => apiCall('notifications', { op: 'mark_read', notificationId }),
    markAllRead: () => apiCall('notifications', { op: 'mark_all_read' }),
    unreadCount: () => apiCall('notifications', { op: 'unread_count' }),
  },

  // ===== Feed Posts (unified: text, photo, video, story — all with product) =====
  feedPosts: {
    list: (limit = 50, sellerId?: string) =>
      apiCall('feed-posts', { op: 'list', limit, sellerId }),
    create: (data: { postType: 'video' | 'photo' | 'text' | 'story'; productId: number; caption?: string; mediaUrl?: string; thumbnailUrl?: string }) =>
      apiCall('feed-posts', { op: 'create', ...data }),
    delete: (postId: number) =>
      apiCall('feed-posts', { op: 'delete', postId }),
    mine: () =>
      apiCall('feed-posts', { op: 'mine' }),
  },
};

// ===== Utility functions =====
export function formatPrice(n: number): string {
  return `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] as string));
}

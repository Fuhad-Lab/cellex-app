/**
 * Cellex Edge Function Client (HTTP-Only Cookie Auth — Production Standard)
 * --------------------------------------------------------------------------
 * NO localStorage. NO sessionStorage. NO cookies in JavaScript. NO tokens.
 *
 * This is the same approach used by AliExpress, Temu, Alibaba, Amazon,
 * Gmail, and Netflix — HTTP-only cookies that JavaScript CANNOT read.
 *
 * How it works:
 *   - Login: POST /api/auth → server creates session in Supabase → sets
 *     HTTP-only cookie with session_id → returns { user } (no session_id in JS)
 *   - All requests: browser AUTOMATICALLY sends the HTTP-only cookie →
 *     server reads it → forwards as Authorization: Bearer <session_id>
 *   - checkSession(): POST /api/auth { op: 'session' } → server reads cookie
 *     → edge function verifies → returns { user }
 *   - Logout: POST /api/auth { op: 'logout' } → server clears cookie
 *
 * Security:
 *   - HTTP-only cookie: JavaScript CANNOT read it (document.cookie returns nothing)
 *   - Secure: only sent over HTTPS
 *   - SameSite=Lax: CSRF protection
 *   - 7-day expiry: persists across tabs, browser restarts, and 7 days
 *   - The cookie only contains a random UUID (session_id), NOT a JWT token
 *   - The actual JWT tokens live in Supabase web_sessions table
 *   - NO localStorage. NO sessionStorage. NO tokens in JavaScript.
 *
 * The frontend has ZERO knowledge of the session_id. It just calls API
 * endpoints and the browser handles the cookie automatically.
 */

(function() {
    'use strict';

    // User cached in memory (NOT in localStorage/sessionStorage)
    // This is just a cache so we don't call checkSession() on every render.
    // The actual auth state is determined by the HTTP-only cookie.
    let currentUser = null;
    let sessionVerified = false;

    /**
     * Call an API endpoint. The browser automatically sends the HTTP-only
     * cookie with every request — we don't need to attach anything.
     */
    async function call(path, body = {}) {
        const headers = {
            'Content-Type': 'application/json',
        };

        try {
            const resp = await fetch(`/api/${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                credentials: 'same-origin',  // Send cookies for same-origin
            });

            const data = await resp.json();

            if (!resp.ok) {
                console.error(`[EdgeFunctions] /api/${path} failed:`, resp.status, data);
                return { success: false, error: data.error || 'Request failed', status: resp.status };
            }

            return data;
        } catch (error) {
            console.error(`[EdgeFunctions] /api/${path} network error:`, error);
            return { success: false, error: error.message || 'Network error' };
        }
    }

    // ---- Auth operations ----

    async function login(email, password) {
        const result = await call('auth', { op: 'login', email, password });

        // Server sets HTTP-only cookie. We just cache the user.
        if (result.success && result.user) {
            currentUser = result.user;
            sessionVerified = true;
        }

        return result;
    }

    async function signup(email, password) {
        const result = await call('auth', { op: 'signup', email, password });

        if (result.success && result.user) {
            currentUser = result.user;
            sessionVerified = true;
        }

        return result;
    }

    async function logout() {
        const result = await call('auth', { op: 'logout' });
        // Server clears the HTTP-only cookie.
        currentUser = null;
        sessionVerified = false;
        return result;
    }

    /**
     * Check if user is logged in by asking the server.
     * The server reads the HTTP-only cookie (which JS can't see) and
     * verifies the session with the edge function.
     *
     * Call this on EVERY page load to restore the user session.
     * The browser auto-sends the cookie, so this works across tabs and
     * browser restarts.
     */
    async function checkSession() {
        // If we already verified this session and have a user, return cached
        if (sessionVerified && currentUser) {
            return { success: true, user: currentUser };
        }

        // Ask the server to check the HTTP-only cookie
        const result = await call('auth', { op: 'session' });
        sessionVerified = true;

        if (result.success && result.user) {
            currentUser = result.user;
            return { success: true, user: currentUser };
        }

        currentUser = null;
        return { success: true, user: null };
    }

    function getCurrentUser() {
        return currentUser;
    }

    async function getCurrentUserAsync() {
        if (currentUser) return currentUser;
        await checkSession();
        return currentUser;
    }

    function isLoggedIn() {
        return !!currentUser;
    }

    // Expose the EdgeFunctions module globally
    window.EdgeFunctions = {
        auth: {
            login,
            signup,
            logout,
            checkSession,
            getCurrentUser,
            getCurrentUserAsync,
            isLoggedIn,
        },

        aiChat: (message, context = {}) => call('ai-chat', { message, context }),

        cart: {
            get: () => call('cart', { op: 'get' }),
            count: () => call('cart', { op: 'count' }),
            add: (productId, quantity = 1) => call('cart', { op: 'add', productId, quantity }),
            remove: (cartItemId) => call('cart', { op: 'remove', cartItemId }),
            update: (cartItemId, quantity) => call('cart', { op: 'update', cartItemId, quantity }),
            clear: () => call('cart', { op: 'clear' }),
        },

        products: {
            home: () => call('products', { op: 'home' }),
            search: (query, maxPrice = null) => call('products', { op: 'search', query, maxPrice }),
            category: (category, sort = 'newest', page = 1) => call('products', { op: 'category', category, sort, page }),
            byId: (id) => call('products', { op: 'by_id', id }),
            all: (limit = 100) => call('products', { op: 'all', limit }),
        },

        orders: {
            list: () => call('orders', { op: 'list' }),
            details: (orderId) => call('orders', { op: 'details', orderId }),
        },

        profile: {
            get: () => call('profile', { op: 'get' }),
            update: (data) => call('profile', { op: 'update', ...data }),
        },

        wishlist: {
            get: () => call('wishlist', { op: 'get' }),
            add: (productId) => call('wishlist', { op: 'add', productId }),
            remove: (wishlistItemId) => call('wishlist', { op: 'remove', wishlistItemId }),
        },

        checkout: {
            prepare: () => call('checkout', { op: 'prepare' }),
            placeOrder: (shippingAddress) => call('checkout', { op: 'place_order', shippingAddress }),
        },

        // ---- Seller dashboard (Phase 0 — migrated from "Eesha selling folder") ----
        sellerDashboard: {
            stats: () => call('seller-dashboard', { op: 'stats' }),
            recent: () => call('seller-dashboard', { op: 'recent' }),
            notifications: () => call('seller-dashboard', { op: 'notifications' }),
        },

        sellerProducts: {
            list: () => call('seller-products', { op: 'list' }),
            create: (data) => call('seller-products', { op: 'create', ...data }),
            update: (id, data) => call('seller-products', { op: 'update', id, ...data }),
            delete: (id) => call('seller-products', { op: 'delete', id }),
        },

        sellerOrders: {
            list: () => call('seller-orders', { op: 'list' }),
            details: (orderId) => call('seller-orders', { op: 'details', orderId }),
        },

        sellerProfile: {
            get: () => call('seller-profile', { op: 'get' }),
            update: (data) => call('seller-profile', { op: 'update', ...data }),
        },

        // ---- Social (Phase 1) ----
        social: {
            // Public — no auth required
            publicProfile: (sellerId, viewerId = null) => call('social', { op: 'public_profile', sellerId, viewerId }),
            sellerFeed: (sellerId, limit = 20) => call('social', { op: 'seller_feed', sellerId, limit }),
            discover: (limit = 12) => call('social', { op: 'discover', limit }),

            // Auth required
            follow: (sellerId) => call('social', { op: 'follow', sellerId }),
            unfollow: (sellerId) => call('social', { op: 'unfollow', sellerId }),
            following: () => call('social', { op: 'following' }),
            feed: (limit = 20, offset = 0) => call('social', { op: 'feed', limit, offset }),
        },

        call,
    };

    console.log('[EdgeFunctions] HTTP-only cookie auth initialized (no localStorage, no sessionStorage, no tokens in JS)');
})();

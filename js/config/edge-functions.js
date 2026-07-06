/**
 * Cellex Edge Function Client (Cookie-Based Auth Edition)
 * -------------------------------------------------------
 * NO localStorage. NO tokens in JavaScript. NO Supabase references.
 *
 * Auth flow:
 *   - Login: POST /api/auth/login → server sets HTTP-only cookie → returns {user}
 *   - Session: POST /api/auth/session → server reads cookie → returns {user|null}
 *   - Logout: POST /api/auth/logout → server clears cookie
 *   - All other calls: browser sends cookie automatically, server adds Bearer header
 *
 * The user object is stored in MEMORY ONLY (lost on page refresh).
 * Each page must call checkSession() on load to restore the user.
 *
 * Usage:
 *   <script src="js/config/edge-functions.js"></script>
 *   // On page load:
 *   await window.EdgeFunctions.auth.checkSession();
 *   // Then use:
 *   window.EdgeFunctions.cart.add(productId);
 */

(function() {
    'use strict';

    // User stored in MEMORY ONLY — not localStorage, not sessionStorage
    let currentUser = null;
    let sessionChecked = false;

    /**
     * Call an API endpoint. Cookies are sent automatically by the browser.
     * No Authorization header needed — the server reads the HTTP-only cookie.
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
                credentials: 'same-origin',  // Send cookies for same-origin requests
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

    // ---- Auth operations (cookie-based, no localStorage) ----

    async function login(email, password) {
        const result = await call('auth', { op: 'login', email, password });

        // Server sets HTTP-only cookie with the token.
        // We only get the user object back (no token in response).
        if (result.success && result.user) {
            currentUser = result.user;
        }

        return result;
    }

    async function signup(email, password) {
        const result = await call('auth', { op: 'signup', email, password });

        if (result.success && result.user) {
            currentUser = result.user;
        }

        return result;
    }

    async function logout() {
        const result = await call('auth', { op: 'logout' });
        // Server clears the cookie.
        currentUser = null;
        return result;
    }

    async function checkSession() {
        // If we already checked this session and have a user, return cached
        if (currentUser) {
            return { success: true, user: currentUser };
        }

        const result = await call('auth', { op: 'session' });
        sessionChecked = true;

        if (result.success && result.user) {
            currentUser = result.user;
            return { success: true, user: currentUser };
        }

        currentUser = null;
        return { success: true, user: null };
    }

    /**
     * Get current user from memory (synchronous).
     * Returns null if checkSession() hasn't been called or user isn't logged in.
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Get current user (async — calls checkSession if needed).
     * Use this when you need to guarantee the user object is available.
     */
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
        // Auth (cookie-based, no tokens in JS)
        auth: {
            login,
            signup,
            logout,
            checkSession,
            getCurrentUser,
            getCurrentUserAsync,
            isLoggedIn,
        },

        // AI Chat
        aiChat: (message, context = {}) => call('ai-chat', { message, context }),

        // Cart operations
        cart: {
            get: () => call('cart', { op: 'get' }),
            count: () => call('cart', { op: 'count' }),
            add: (productId, quantity = 1) => call('cart', { op: 'add', productId, quantity }),
            remove: (cartItemId) => call('cart', { op: 'remove', cartItemId }),
            update: (cartItemId, quantity) => call('cart', { op: 'update', cartItemId, quantity }),
            clear: () => call('cart', { op: 'clear' }),
        },

        // Products
        products: {
            home: () => call('products', { op: 'home' }),
            search: (query, maxPrice = null) => call('products', { op: 'search', query, maxPrice }),
            category: (category, sort = 'newest', page = 1) => call('products', { op: 'category', category, sort, page }),
            byId: (id) => call('products', { op: 'by_id', id }),
            all: (limit = 100) => call('products', { op: 'all', limit }),
        },

        // Orders
        orders: {
            list: () => call('orders', { op: 'list' }),
            details: (orderId) => call('orders', { op: 'details', orderId }),
        },

        // Profile
        profile: {
            get: () => call('profile', { op: 'get' }),
            update: (data) => call('profile', { op: 'update', ...data }),
        },

        // Wishlist
        wishlist: {
            get: () => call('wishlist', { op: 'get' }),
            add: (productId) => call('wishlist', { op: 'add', productId }),
            remove: (wishlistItemId) => call('wishlist', { op: 'remove', wishlistItemId }),
        },

        // Checkout
        checkout: {
            prepare: () => call('checkout', { op: 'prepare' }),
            placeOrder: (shippingAddress) => call('checkout', { op: 'place_order', shippingAddress }),
        },

        // Raw call (for advanced use)
        call,
    };

    console.log('[EdgeFunctions] Cookie-based auth client initialized (no localStorage)');
})();

/**
 * Cellex Edge Function Client (Supabase Session-Based Auth)
 * ----------------------------------------------------------
 * NO localStorage. NO cookies. NO tokens in JavaScript.
 *
 * The session_id (a random UUID, NOT a token) is stored in sessionStorage.
 * sessionStorage survives page refreshes and navigations within the same tab,
 * but is automatically cleared when the tab closes — more secure than localStorage.
 *
 * Auth flow:
 *   - Login: POST /api/auth → edge function stores JWT tokens in web_sessions
 *     table in Supabase → returns { session_id, user }
 *   - Frontend stores session_id in sessionStorage (just a UUID, useless without DB)
 *   - Each page load: checkSession() reads session_id from sessionStorage,
 *     sends it to the edge function which looks up the real tokens in Supabase
 *   - Each API request: session_id sent via X-Session-Id header
 *   - Logout: deletes session from web_sessions + clears sessionStorage
 *
 * Security:
 *   - No JWT tokens in the browser (they're in Supabase web_sessions table)
 *   - sessionStorage only has a random UUID — useless if stolen via XSS
 *   - Session is cleared when tab closes
 */

(function() {
    'use strict';

    const SESSION_KEY = 'cellex_session_id';

    // Get session_id from sessionStorage (survives navigation, cleared on tab close)
    let sessionId = sessionStorage.getItem(SESSION_KEY) || null;
    let currentUser = null;

    /**
     * Call an API endpoint. Sends X-Session-Id header for auth.
     */
    async function call(path, body = {}) {
        const headers = {
            'Content-Type': 'application/json',
        };

        // Attach session_id if we have one
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }

        try {
            const resp = await fetch(`/api/${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                credentials: 'same-origin',
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

        if (result.success && result.session_id) {
            sessionId = result.session_id;
            sessionStorage.setItem(SESSION_KEY, sessionId);
            currentUser = result.user;
        }

        return result;
    }

    async function signup(email, password) {
        const result = await call('auth', { op: 'signup', email, password });

        if (result.success && result.session_id) {
            sessionId = result.session_id;
            sessionStorage.setItem(SESSION_KEY, sessionId);
            currentUser = result.user;
        }

        return result;
    }

    async function logout() {
        if (sessionId) {
            await call('auth', { op: 'logout', session_id: sessionId });
        }
        sessionId = null;
        currentUser = null;
        sessionStorage.removeItem(SESSION_KEY);
        return { success: true };
    }

    /**
     * Check if user is logged in by sending session_id to the server.
     * The edge function looks up the session_id in web_sessions table,
     * verifies the JWT token, and returns the user object.
     *
     * Call this on EVERY page load to restore the user session.
     */
    async function checkSession() {
        // If no session_id stored, user is not logged in
        if (!sessionId) {
            currentUser = null;
            return { success: true, user: null };
        }

        // If we already have the user cached, return it
        if (currentUser) {
            return { success: true, user: currentUser };
        }

        // Ask the server to verify the session_id and return the user
        const result = await call('auth', { op: 'session', session_id: sessionId });

        if (result.success && result.user) {
            currentUser = result.user;
            return { success: true, user: currentUser };
        }

        // Session is invalid or expired — clear it
        sessionId = null;
        currentUser = null;
        sessionStorage.removeItem(SESSION_KEY);
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

    function getSessionId() {
        return sessionId;
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
            getSessionId,
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

        call,
    };

    console.log('[EdgeFunctions] Session-based auth client initialized (sessionStorage for session_id only)');
})();

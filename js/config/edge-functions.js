/**
 * Cellex Edge Function Client (Zero-Supabase Edition)
 * -------------------------------------------------------
 * The frontend has ZERO knowledge of Supabase:
 *   - No Supabase URL
 *   - No anon key
 *   - No Supabase JS SDK
 *   - No supabase.auth.* calls
 *
 * All requests go through RELATIVE URLs (/api/*) which are proxied by the
 * Render server. The Render server adds the Supabase URL + anon key from
 * its environment variables before forwarding to the edge functions.
 *
 * If someone clones the site with HTTrack/wget, they get:
 *   - HTML/CSS (UI shell)
 *   - This JS file (which only contains /api/* relative URLs)
 *   - No Supabase URL, no keys, no system prompts, no query logic
 *
 * Usage:
 *   <script src="js/config/edge-functions.js"></script>
 *   const products = await EdgeFunctions.products.home();
 *   const result = await EdgeFunctions.cart.add(productId);
 *   const session = await EdgeFunctions.auth.login(email, password);
 */

(function() {
    'use strict';

    // Auth token stored in memory (and localStorage for persistence across page loads)
    let authToken = localStorage.getItem('eeshamart_auth_token') || null;
    let currentUser = JSON.parse(localStorage.getItem('eeshamart_user') || 'null');

    /**
     * Get the current auth token (from memory/localStorage).
     */
    function getAuthToken() {
        return authToken;
    }

    /**
     * Get current user object (cached from login).
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Check if user is logged in (has a token).
     */
    function isLoggedIn() {
        return !!authToken;
    }

    /**
     * Call an API endpoint via the Render proxy.
     * All URLs are RELATIVE — no Supabase info anywhere.
     */
    async function call(path, body = {}) {
        const headers = {
            'Content-Type': 'application/json',
        };

        // Attach auth token if we have one
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        try {
            const resp = await fetch(`/api/${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
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

    // ---- Auth operations (replaces supabase.auth.*) ----

    async function login(email, password) {
        const result = await call('auth', { op: 'login', email, password });

        if (result.success && result.access_token) {
            authToken = result.access_token;
            currentUser = result.user;
            localStorage.setItem('eeshamart_auth_token', authToken);
            localStorage.setItem('eeshamart_user', JSON.stringify(currentUser));
        }

        return result;
    }

    async function signup(email, password) {
        const result = await call('auth', { op: 'signup', email, password });

        if (result.success && result.access_token) {
            authToken = result.access_token;
            currentUser = result.user;
            localStorage.setItem('eeshamart_auth_token', authToken);
            localStorage.setItem('eeshamart_user', JSON.stringify(currentUser));
        }

        return result;
    }

    async function logout() {
        const refreshToken = localStorage.getItem('eeshamart_refresh_token');
        if (refreshToken) {
            await call('auth', { op: 'logout', refresh_token: refreshToken });
        }
        authToken = null;
        currentUser = null;
        localStorage.removeItem('eeshamart_auth_token');
        localStorage.removeItem('eeshamart_user');
        localStorage.removeItem('eeshamart_refresh_token');
        return { success: true };
    }

    async function checkSession() {
        if (!authToken) {
            return { success: true, user: null };
        }

        const result = await call('auth', { op: 'session' });

        if (result.success && result.user) {
            currentUser = result.user;
            localStorage.setItem('eeshamart_user', JSON.stringify(currentUser));
            return { success: true, user: result.user };
        }

        // Token is invalid/expired — clear it
        authToken = null;
        currentUser = null;
        localStorage.removeItem('eeshamart_auth_token');
        localStorage.removeItem('eeshamart_user');
        return { success: true, user: null };
    }

    // Expose the EdgeFunctions module globally
    window.EdgeFunctions = {
        // Auth (replaces supabase.auth.*)
        auth: {
            login,
            signup,
            logout,
            checkSession,
            getAuthToken,
            getCurrentUser,
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

        // Raw call (for advanced use)
        call,
    };

    console.log('[EdgeFunctions] Zero-Supabase client initialized');
})();

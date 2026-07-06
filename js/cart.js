/**
 * Cellex Cart Module (Zero-Supabase Edition)
 * ------------------------------------------
 * All cart operations go through the Render proxy → Supabase Edge Function.
 * No Supabase JS SDK, no supabase.auth calls, no Supabase URL.
 *
 * Usage:
 *   <script src="js/config/edge-functions.js"></script>
 *   <script src="js/cart.js"></script>
 *   window.Cart.addToCart(productId);
 */

(function() {
    'use strict';

    // Get current user from EdgeFunctions (replaces supabase.auth.getSession)
    function getCurrentUser() {
        return window.EdgeFunctions.auth.getCurrentUser();
    }

    /**
     * Get total cart items count
     */
    async function getCartCount() {
        if (!window.EdgeFunctions.auth.isLoggedIn()) return 0;

        const result = await window.EdgeFunctions.cart.count();
        if (!result.success) {
            console.error('[Cart] Error fetching cart count:', result.error);
            return 0;
        }
        return result.count || 0;
    }

    /**
     * Update all cart count elements on the page
     */
    async function updateCartCountUI() {
        const count = await getCartCount();

        const cartCountEl = document.getElementById('cartCount');
        const mobileCartCountEl = document.getElementById('mobileCartCount');

        if (cartCountEl) {
            cartCountEl.textContent = count;
            cartCountEl.style.display = count > 0 ? 'flex' : 'none';
        }

        if (mobileCartCountEl) {
            mobileCartCountEl.textContent = count;
            mobileCartCountEl.style.display = count > 0 ? 'flex' : 'none';
        }

        return count;
    }

    /**
     * Get all cart items with product details
     */
    async function getCartItems() {
        if (!window.EdgeFunctions.auth.isLoggedIn()) {
            return [];
        }

        const result = await window.EdgeFunctions.cart.get();
        if (!result.success) {
            console.error('[Cart] Error fetching cart items:', result.error);
            return [];
        }

        return result.items || [];
    }

    /**
     * Add item to cart
     */
    async function addToCart(productId, quantity = 1) {
        if (!window.EdgeFunctions.auth.isLoggedIn()) {
            return {
                success: false,
                requiresAuth: true,
                message: 'Please login to add items to cart'
            };
        }

        const result = await window.EdgeFunctions.cart.add(productId, quantity);

        if (result.success) {
            await updateCartCountUI();
            return { success: true, message: 'Added to cart!' };
        }

        return { success: false, message: result.error || 'Failed to add to cart' };
    }

    /**
     * Remove item from cart
     */
    async function removeFromCart(cartItemId) {
        if (!window.EdgeFunctions.auth.isLoggedIn()) {
            return { success: false, message: 'Please login' };
        }

        const result = await window.EdgeFunctions.cart.remove(cartItemId);

        if (result.success) {
            await updateCartCountUI();
            return { success: true, message: 'Item removed' };
        }

        return { success: false, message: result.error || 'Failed to remove item' };
    }

    /**
     * Update item quantity
     */
    async function updateQuantity(cartItemId, newQuantity) {
        if (!window.EdgeFunctions.auth.isLoggedIn()) {
            return { success: false, message: 'Please login' };
        }

        if (newQuantity < 1) {
            return await removeFromCart(cartItemId);
        }

        const result = await window.EdgeFunctions.cart.update(cartItemId, newQuantity);

        if (result.success) {
            await updateCartCountUI();
            return { success: true, message: 'Quantity updated' };
        }

        return { success: false, message: result.error || 'Failed to update quantity' };
    }

    /**
     * Clear entire cart
     */
    async function clearCart() {
        if (!window.EdgeFunctions.auth.isLoggedIn()) {
            return { success: false, message: 'Please login' };
        }

        const result = await window.EdgeFunctions.cart.clear();

        if (result.success) {
            await updateCartCountUI();
            return { success: true, message: 'Cart cleared' };
        }

        return { success: false, message: result.error || 'Failed to clear cart' };
    }

    /**
     * Get cart subtotal
     */
    async function getCartSubtotal() {
        const cartItems = await getCartItems();
        return cartItems.reduce((sum, item) => {
            const price = item.products?.price || 0;
            return sum + (price * (item.quantity || 0));
        }, 0);
    }

    /**
     * Initialize cart on page load
     */
    async function initCart() {
        await updateCartCountUI();
    }

    // Expose Cart module globally
    window.Cart = {
        getCartCount,
        updateCartCountUI,
        getCartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartSubtotal,
        initCart,
        getCurrentUser
    };

    // Auto-initialize on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', async () => {
        setTimeout(async () => {
            await initCart();
        }, 100);
    });

})();

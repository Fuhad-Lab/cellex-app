// Product detail page logic — uses EdgeFunctions (cookie-based auth, no Supabase SDK).
// Requires: ../js/config/edge-functions.js and ../js/cart.js loaded before this file.

// Get product ID from URL
function getProductIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Load product details via edge function
async function loadProductDetails() {
    const productId = getProductIdFromUrl();
    if (!productId) {
        window.location.href = '/index.html';
        return;
    }

    try {
        // Show loading states
        document.getElementById('loadingSkeleton').classList.remove('hidden');
        document.getElementById('loadingText').classList.remove('hidden');
        document.getElementById('productImagesContainer').classList.add('hidden');
        document.getElementById('productInfo').classList.add('hidden');
        document.getElementById('priceSection').classList.add('hidden');
        document.getElementById('descriptionSection').classList.add('hidden');

        // Fetch product via edge function
        const result = await window.EdgeFunctions.products.byId(productId);

        if (!result.success || !result.product) {
            console.error('Error loading product:', result.error);
            window.location.href = '/index.html';
            return;
        }

        const product = result.product;

        // Hide loading states
        document.getElementById('loadingSkeleton').classList.add('hidden');
        document.getElementById('loadingText').classList.add('hidden');
        document.getElementById('productImagesContainer').classList.remove('hidden');
        document.getElementById('productInfo').classList.remove('hidden');
        document.getElementById('priceSection').classList.remove('hidden');
        document.getElementById('descriptionSection').classList.remove('hidden');

        // Update the UI with product details
        document.getElementById('mainImage').src = product.image_url;
        document.getElementById('productName').textContent = product.name;
        document.getElementById('productCategory').textContent = product.category || 'General';
        document.getElementById('productPrice').textContent = `₦${product.price.toFixed(2)}`;
        document.getElementById('productDescription').textContent = product.description;

        // Handle optional fields
        if (product.original_price) {
            document.getElementById('originalPrice').textContent = `₦${product.original_price.toFixed(2)}`;
            const discount = Math.round(((product.original_price - product.price) / product.original_price) * 100);
            document.getElementById('discountBadge').textContent = `-${discount}%`;
        } else {
            document.getElementById('originalPrice').classList.add('hidden');
            document.getElementById('discountBadge').classList.add('hidden');
        }

        // Update page title
        document.title = `${product.name} - Eesha`;

        // Handle product images
        const thumbnailContainer = document.getElementById('thumbnailContainer');
        thumbnailContainer.innerHTML = ''; // Clear existing thumbnails

        // Add main image to thumbnails
        const mainThumbnail = createThumbnail(product.image_url, product.name, true);
        thumbnailContainer.appendChild(mainThumbnail);

        // Add additional images if available
        if (product.additional_images && Array.isArray(product.additional_images)) {
            product.additional_images.forEach(imgUrl => {
                const thumbnail = createThumbnail(imgUrl, product.name);
                thumbnailContainer.appendChild(thumbnail);
            });
        }

        // Handle rating if available
        if (product.rating) {
            const ratingDiv = document.getElementById('productRating');
            const stars = '★'.repeat(Math.floor(product.rating)) + '☆'.repeat(5 - Math.floor(product.rating));
            ratingDiv.innerHTML = `
                <div class="text-yellow-400">${stars}</div>
                <span class="text-gray-600">(${product.rating_count || 0} reviews)</span>
            `;
        }

    } catch (error) {
        console.error('Error loading product:', error);
        alert('Error loading product details. Please try again.');
    }
}

// Quantity management
let quantity = 1;

function increaseQty() {
    quantity++;
    updateQuantityDisplay();
}

function decreaseQty() {
    if (quantity > 1) {
        quantity--;
        updateQuantityDisplay();
    }
}

function updateQuantityDisplay() {
    document.getElementById('quantity').textContent = quantity;
}

// Add to cart functionality — uses Cart module (requires login, cookie-based)
async function addToCart() {
    const productId = getProductIdFromUrl();
    if (!productId) return;

    try {
        // Cart module handles auth check + cart upsert internally
        const result = await window.Cart.addToCart(productId, quantity);

        if (!result.success) {
            if (result.requiresAuth) {
                // Redirect to login
                if (confirm('Please login to add items to your cart. Go to login page?')) {
                    window.location.href = `login.html?redirect=product&id=${productId}`;
                }
                return;
            }
            alert(result.message || 'Failed to add to cart. Please try again.');
            return;
        }

        // Visual feedback
        const addBtn = document.querySelector('button[onclick="addToCart()"]');
        if (addBtn) {
            const orig = addBtn.innerHTML;
            addBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
            addBtn.classList.add('bg-green-500');
            setTimeout(() => {
                addBtn.innerHTML = orig;
                addBtn.classList.remove('bg-green-500');
            }, 1500);
        }

    } catch (error) {
        console.error('Add to cart failed:', error);
        alert('Failed to add to cart. Please try again.');
    }
}

// Update cart count in header — delegates to shared Cart module
async function updateCartCount() {
    try {
        if (window.Cart && window.Cart.updateCartCountUI) {
            await window.Cart.updateCartCountUI();
        }
    } catch (err) {
        console.error('Error updating cart count:', err);
    }
}

// Image gallery functionality
function createThumbnail(imageUrl, altText, isActive = false) {
    const div = document.createElement('div');
    div.className = `cursor-pointer rounded-lg overflow-hidden border-2 ${isActive ? 'border-brand-500' : 'border-transparent'}`;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = altText;
    img.className = 'w-full h-full object-cover aspect-square';

    div.appendChild(img);

    div.addEventListener('click', () => {
        // Update main image
        updateMainImage(imageUrl);

        // Update active state of thumbnails
        document.querySelectorAll('#thumbnailContainer > div').forEach(thumb => {
            thumb.classList.remove('border-brand-500');
            thumb.classList.add('border-transparent');
        });
        div.classList.remove('border-transparent');
        div.classList.add('border-brand-500');
    });

    return div;
}

function updateMainImage(imageUrl) {
    const mainImage = document.getElementById('mainImage');
    mainImage.src = imageUrl;
}

// Global user state (kept in memory only — no localStorage)
let currentUser = null;

// With cookie-based auth there is no guest cart in localStorage to merge.
// This function is retained as a no-op for backwards compatibility with the
// existing init flow.
async function mergeGuestCartAfterSignIn() {
    return;
}

function updateUIforAuthState(user) {
    const loginLink = document.getElementById('login-link');
    const signupLink = document.getElementById('signup-link');
    const userMenu = document.getElementById('user-menu');
    const userEmail = document.getElementById('user-email');
    const mobileLogin = document.querySelector('#mobile-auth-links a[href="login.html"]') || document.querySelector('#mobile-auth-links a[href="Eesha buying folder/login.html"]');
    const mobileSignup = document.querySelector('#mobile-auth-links a[href="signup.html"]') || document.querySelector('#mobile-auth-links a[href="Eesha buying folder/signup.html"]');
    const mobileLogout = document.getElementById('mobile-logout-button');

    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (userEmail) userEmail.textContent = user.email || '';
        if (mobileLogin) mobileLogin.style.display = 'none';
        if (mobileSignup) mobileSignup.style.display = 'none';
        if (mobileLogout) mobileLogout.style.display = 'block';
    } else {
        if (loginLink) loginLink.style.display = 'block';
        if (signupLink) signupLink.style.display = 'block';
        if (userMenu) userMenu.style.display = 'none';
        if (mobileLogin) mobileLogin.style.display = 'block';
        if (mobileSignup) mobileSignup.style.display = 'block';
        if (mobileLogout) mobileLogout.style.display = 'none';
    }
}

// Initialize page and auth handling
document.addEventListener('DOMContentLoaded', async () => {
    // Restore session via cookie-based auth (no onAuthStateChange available)
    try {
        const { user } = await window.EdgeFunctions.auth.checkSession();
        currentUser = user || null;
        updateUIforAuthState(currentUser);
        await updateCartCount();
    } catch (err) {
        console.error('Error checking initial session:', err);
    }

    // Wire up logout buttons if present (cookie-based logout clears server cookie)
    const logoutButton = document.getElementById('logout-button');
    const mobileLogoutButton = document.getElementById('mobile-logout-button');
    if (logoutButton) logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.EdgeFunctions.auth.logout();
        currentUser = null;
        updateUIforAuthState(null);
        await updateCartCount();
        window.location.reload();
    });
    if (mobileLogoutButton) mobileLogoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.EdgeFunctions.auth.logout();
        currentUser = null;
        updateUIforAuthState(null);
        await updateCartCount();
        window.location.reload();
    });

    // User menu toggle
    const userMenuButton = document.getElementById('user-menu-button');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    if (userMenuButton && userMenuDropdown) {
        userMenuButton.addEventListener('click', () => userMenuDropdown.classList.toggle('hidden'));
        document.addEventListener('click', (e) => {
            if (!document.getElementById('user-menu').contains(e.target)) {
                userMenuDropdown.classList.add('hidden');
            }
        });
    }

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

    // Finally load product details and update cart count
    await loadProductDetails();
    await updateCartCount();
});

// Search bar behavior (navigate to search-result.html with query)
(function setupSearch() {
    try {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        const goToSearch = () => {
            const q = (searchInput.value || '').trim();
            if (!q) return;
            // keep relative path consistent with index/product location
            window.location.href = `../search-result.html?q=${encodeURIComponent(q)}`;
        };

        // Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') goToSearch();
        });

        // If there's an adjacent button (search icon) try to attach click
        const btn = searchInput.parentElement?.querySelector('button');
        if (btn) btn.addEventListener('click', goToSearch);
    } catch (err) {
        console.error('Search setup failed:', err);
    }
})();

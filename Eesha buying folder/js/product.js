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
        window._currentProduct = product;  // cache for share functions

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

    // Phase 2: load reviews + active group buys for this product
    loadProductReviews();
    loadActiveGroupBuys();
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

// ====================================================================
// Phase 2: Product sharing, group buy, reviews
// ====================================================================
function getCurrentProductId() {
    return getProductIdFromUrl();
}

function getCurrentProduct() {
    // Stored when loadProductDetails runs
    return window._currentProduct || null;
}

// ---- Sharing ----
function shareProduct(platform) {
    const id = getCurrentProductId();
    if (!id) return;
    const url = `${window.location.origin}/Eesha%20buying%20folder/product.html?id=${id}`;
    const product = getCurrentProduct();
    const text = product
        ? `Check out "${product.name}" on Cellex — $${Number(product.price).toFixed(2)}`
        : 'Check out this product on Cellex';

    if (platform === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    }
}

async function copyShareLink() {
    const id = getCurrentProductId();
    if (!id) return;
    const url = `${window.location.origin}/Eesha%20buying%20folder/product.html?id=${id}`;
    try {
        await navigator.clipboard.writeText(url);
        const btn = event?.target?.closest('button');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => btn.innerHTML = orig, 1500);
        }
    } catch (e) {
        window.prompt('Copy this link:', url);
    }
}

// ---- Group buy ----
async function startGroupBuy() {
    const productId = getCurrentProductId();
    if (!productId) return;
    if (!currentUser) {
        if (confirm('Please login to start a group buy. Go to login page?')) {
            window.location.href = `login.html?next=${encodeURIComponent('/Eesha buying folder/product.html?id=' + productId)}`;
        }
        return;
    }
    if (!confirm('Start a group buy?\n\nGet 3 friends to join and everyone gets 20% off.\n\nWe will generate a share link for you.')) return;
    const r = await window.EdgeFunctions.groupBuy.create(Number(productId), 3, 20);
    if (r.success) {
        const url = `${window.location.origin}/group-buy.html?id=${r.groupBuy.id}`;
        const shareText = `🛍️ Join my group buy on Cellex! Get 20% off when 3 of us join. ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        // Also navigate to the group buy page
        window.location.href = `/group-buy.html?id=${r.groupBuy.id}`;
    } else {
        alert('Failed to start group buy: ' + (r.error || 'Unknown error'));
    }
}

async function loadActiveGroupBuys() {
    const productId = getCurrentProductId();
    if (!productId) return;
    const container = document.getElementById('activeGroupBuys');
    if (!container) return;
    try {
        const r = await window.EdgeFunctions.groupBuy.active(Number(productId));
        if (!r.success || !r.groupBuys || r.groupBuys.length === 0) return;
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
                    <i class="fas fa-fire"></i> ${r.groupBuys.length} active group buy${r.groupBuys.length > 1 ? 's' : ''} — join & get 20% off!
                </div>
                ${r.groupBuys.map(gb => `
                    <a href="/group-buy.html?id=${gb.id}" class="block text-sm text-amber-900 hover:underline">
                        👥 ${gb.current_count}/${gb.target_count} joined · expires ${new Date(gb.expires_at).toLocaleString()}
                    </a>
                `).join('')}
            </div>`;
    } catch (e) { /* silent fail */ }
}

// ---- Reviews ----
async function loadProductReviews() {
    const productId = getCurrentProductId();
    if (!productId) return;
    try {
        const r = await window.EdgeFunctions.reviews.byProduct(Number(productId));
        if (!r.success) return;

        // Summary
        const summary = document.getElementById('reviewsSummary');
        if (r.summary.count > 0) {
            summary.classList.remove('hidden');
            document.getElementById('reviewsAvg').textContent = Number(r.summary.avg).toFixed(1);
            document.getElementById('reviewsStars').textContent =
                '★'.repeat(Math.round(r.summary.avg)) + '☆'.repeat(5 - Math.round(r.summary.avg));
            document.getElementById('reviewsCount').textContent = `${r.summary.count} review${r.summary.count > 1 ? 's' : ''}`;
            document.getElementById('reviewsBlurb').textContent =
                r.summary.avg >= 4 ? 'Buyers love this product!' :
                r.summary.avg >= 3 ? 'Most buyers are satisfied.' :
                'Mixed reviews — read below.';
        }

        // List
        const list = document.getElementById('reviewsList');
        if (!r.reviews || r.reviews.length === 0) {
            list.innerHTML = '<div class="text-gray-500 text-sm">No reviews yet. Be the first to write one!</div>';
            return;
        }
        list.innerHTML = r.reviews.map(rev => `
            <div class="border-b pb-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                            ${(rev.reviewer_name || 'B').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-medium text-sm">${escapeHtml(rev.reviewer_name || 'Buyer')}</div>
                            <div class="text-xs text-gray-500">${new Date(rev.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="text-yellow-400 text-sm">${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</div>
                </div>
                ${rev.title ? `<div class="font-semibold mt-2">${escapeHtml(rev.title)}</div>` : ''}
                ${rev.comment ? `<p class="text-gray-700 text-sm mt-1">${escapeHtml(rev.comment)}</p>` : ''}
                ${rev.verified_purchase ? '<div class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle"></i> Verified purchase</div>' : ''}
                ${rev.images && rev.images.length ? `<div class="flex gap-2 mt-2">${rev.images.map(img => `<img src="${escapeHtml(img)}" class="w-16 h-16 object-cover rounded">`).join('')}</div>` : ''}
                <button onclick="markHelpful('${rev.id}')" class="text-xs text-gray-500 hover:text-amber-600 mt-2">
                    <i class="fas fa-thumbs-up"></i> Helpful (${rev.helpful_count || 0})
                </button>
            </div>`).join('');
    } catch (e) {
        console.error('reviews load error', e);
    }
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ---- Review modal ----
function openReviewModal() {
    if (!currentUser) {
        if (confirm('Please login to write a review. Go to login page?')) {
            const id = getCurrentProductId();
            window.location.href = `login.html?next=${encodeURIComponent('/Eesha buying folder/product.html?id=' + id)}`;
        }
        return;
    }
    document.getElementById('reviewModal').classList.remove('hidden');
    // Star picker
    document.querySelectorAll('#starPicker button').forEach(btn => {
        btn.onclick = () => {
            const star = parseInt(btn.dataset.star);
            document.getElementById('reviewRating').value = star;
            document.querySelectorAll('#starPicker button').forEach(b => {
                b.classList.remove('text-amber-400');
                b.classList.add('text-gray-300');
            });
            for (let i = 1; i <= star; i++) {
                const b = document.querySelector(`#starPicker button[data-star="${i}"]`);
                if (b) { b.classList.add('text-amber-400'); b.classList.remove('text-gray-300'); }
            }
        };
    });
    document.getElementById('reviewForm').onsubmit = submitReview;
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.add('hidden');
}

async function submitReview(e) {
    e.preventDefault();
    const errEl = document.getElementById('reviewError');
    errEl.classList.add('hidden');
    const rating = parseInt(document.getElementById('reviewRating').value);
    if (!rating || rating < 1 || rating > 5) {
        errEl.textContent = 'Please select a rating (1-5 stars)';
        errEl.classList.remove('hidden');
        return;
    }
    const r = await window.EdgeFunctions.reviews.create({
        productId: Number(getCurrentProductId()),
        rating,
        title: document.getElementById('reviewTitle').value.trim(),
        comment: document.getElementById('reviewComment').value.trim(),
    });
    if (r.success) {
        closeReviewModal();
        await loadProductReviews();
        alert('Thanks for your review!');
    } else {
        errEl.textContent = r.error || 'Failed to submit review';
        errEl.classList.remove('hidden');
    }
}

async function markHelpful(reviewId) {
    const r = await window.EdgeFunctions.reviews.helpful(reviewId);
    if (r.success) await loadProductReviews();
}

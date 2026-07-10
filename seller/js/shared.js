/* Cellex Seller Shared Helpers — Phase 1
   ----------------------------------------
   - Auth gate: redirect to /login.html if not logged in
   - Sidebar render (single source of truth)
   - Toast + small DOM utilities
   - ZERO direct Supabase calls — everything goes through EdgeFunctions */

(function () {
  'use strict';

  // -------- Auth gate --------
  async function requireSeller() {
    // Make sure EdgeFunctions has checked the session
    const { success, user } = await window.EdgeFunctions.auth.checkSession();
    if (!success || !user) {
      window.location.href = '../login.html?next=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  }

  // -------- Sidebar --------
  function renderSidebar(activeKey) {
    const items = [
      { key: 'dashboard', href: 'index.html',          icon: 'fa-gauge-high',     label: 'Dashboard' },
      { key: 'products',  href: 'products.html',       icon: 'fa-box',            label: 'Products' },
      { key: 'videos',    href: 'videos.html',         icon: 'fa-film',           label: 'Product Videos' },
      { key: 'stories',   href: 'stories.html',        icon: 'fa-clock',          label: 'Stories' },
      { key: 'orders',    href: 'orders.html',         icon: 'fa-receipt',        label: 'Orders' },
      { key: 'live',      href: 'go-live.html',        icon: 'fa-broadcast-tower',label: 'Go Live' },
      { key: 'profile',   href: 'profile.html',        icon: 'fa-store',          label: 'Seller Profile' },
      { key: 'academy',   href: 'academy.html',        icon: 'fa-graduation-cap', label: 'Academy' },
      { key: 'settings',  href: 'settings.html',       icon: 'fa-gear',           label: 'Settings' },
    ];
    const nav = items.map(it => `
      <a href="${it.href}" class="seller-nav-item ${it.key === activeKey ? 'active' : ''}">
        <i class="fas ${it.icon}"></i><span>${it.label}</span>
      </a>`).join('');
    return `
      <div class="seller-brand">
        <div class="seller-brand-logo">C</div>
        <div>
          <div class="seller-brand-name">Cellex</div>
          <div class="seller-brand-tag">Seller Center</div>
        </div>
      </div>
      <nav class="seller-nav">${nav}</nav>
      <div class="seller-sidebar-footer">
        <a href="../index.html" style="color:#94a3b8;text-decoration:none;display:block;margin-bottom:0.5rem;">
          <i class="fas fa-arrow-left"></i> Back to store
        </a>
        <a href="#" id="seller-logout-link" style="color:#fbbf24;text-decoration:none;">
          <i class="fas fa-sign-out-alt"></i> Sign out
        </a>
      </div>
    `;
  }

  function mountSidebar(activeKey) {
    const el = document.querySelector('.seller-sidebar');
    if (el) el.innerHTML = renderSidebar(activeKey);

    const toggle = document.querySelector('.seller-mobile-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.querySelector('.seller-sidebar').classList.toggle('open');
      });
    }
    // Close sidebar when clicking a nav link on mobile
    document.querySelectorAll('.seller-nav-item').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          document.querySelector('.seller-sidebar').classList.remove('open');
        }
      });
    });

    // Logout link
    const logoutLink = document.getElementById('seller-logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.EdgeFunctions.auth.logout();
        window.location.href = '../index.html';
      });
    }
  }

  // -------- Toast --------
  function toast(msg, kind = 'success') {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.className = 'toast ' + kind;
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // -------- Format helpers --------
  function money(n) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // -------- Avatar initials --------
  function initials(name) {
    const s = (name || '').trim();
    if (!s) return '?';
    return s.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  window.SellerUI = {
    requireSeller,
    mountSidebar,
    toast,
    money,
    timeAgo,
    escapeHtml,
    initials,
  };

  console.log('[SellerUI] ready');
})();

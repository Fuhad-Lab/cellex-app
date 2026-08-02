'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Share2, X, Users, Tag, Sparkles, ExternalLink } from 'lucide-react';

interface GroupBuySuccessModalProps {
  open: boolean;
  onClose: () => void;
  groupBuy: {
    id: string;
    inviteLink?: string;
    invite_code?: string;
    target_count?: number;
    current_count?: number;
    discount_pct?: number;
    product_name?: string;
    name?: string;
    image_url?: string;
    price?: number;
    groupBuyName?: string;
  } | null;
  product?: {
    name?: string;
    image_url?: string;
    price?: number;
  } | null;
}

/**
 * GroupBuySuccessModal — iOS-style glassmorphism modal shown after a buyer
 * creates a group buy. Shows:
 *   - Success animation (checkmark)
 *   - Auto-generated group buy name
 *   - Product image + price + discount
 *   - Progress (1 joined / N needed)
 *   - Copy link button (with copied! feedback)
 *   - Share button (uses Web Share API with clipboard fallback)
 *   - "View Group Buy Page" link (in case creator wants to see the page)
 *
 * The creator stays on the product page. Only people who click the shared
 * link get redirected to /group-buy-join?code=...
 */
export function GroupBuySuccessModal({ open, onClose, groupBuy, product }: GroupBuySuccessModalProps) {
  const [copied, setCopied] = useState(false);

  // Build the full shareable URL (the edge function returns a relative path
  // like /group-buy-join?code=abc123 — we need the absolute URL for sharing).
  const inviteCode = groupBuy?.invite_code || (groupBuy?.inviteLink?.split('code=')[1] || '');
  const shareUrl = typeof window !== 'undefined' && inviteCode
    ? `${window.location.origin}/group-buy-join?code=${inviteCode}`
    : groupBuy?.inviteLink || '';

  const productName = product?.name || groupBuy?.product_name || groupBuy?.name || 'this product';
  const productImage = product?.image_url || groupBuy?.image_url;
  const originalPrice = product?.price || groupBuy?.price || 0;
  const discountPct = groupBuy?.discount_pct || 20;
  const discountedPrice = originalPrice * (1 - discountPct / 100);
  const targetCount = groupBuy?.target_count || 3;
  const currentCount = groupBuy?.current_count || 1;

  // Auto-generated group buy name — catchy and descriptive
  const groupBuyName = groupBuy?.groupBuyName || generateGroupBuyName(productName, discountPct, targetCount);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open || !groupBuy) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
      document.body.removeChild(textarea);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Join my group buy: ${productName}`,
      text: `I'm buying ${productName} on Cellex with a ${discountPct}% discount! Join my group buy — we need ${targetCount} people to unlock the deal.`,
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl"
        style={{
          // Glassmorphism: semi-transparent white + blur + subtle border
          background: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        }}
      >
        {/* Close button — top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
          }}
          aria-label="Close"
        >
          <X className="w-4 h-4" style={{ color: '#111827' }} strokeWidth={2.5} />
        </button>

        {/* Success checkmark animation */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
            style={{
              background: '#111827',
              boxShadow: '0 8px 24px rgba(17, 24, 39, 0.3)',
            }}
          >
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Group Buy Created!</h2>
          <p className="text-sm mt-1 text-center" style={{ color: '#6B7280' }}>
            Share the link with friends to unlock the discount.
          </p>
        </div>

        {/* Group buy name badge */}
        <div className="px-6 pb-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{
              background: 'rgba(17, 24, 39, 0.06)',
              border: '1px solid rgba(17, 24, 39, 0.08)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#111827' }} />
            <span className="text-xs font-semibold truncate" style={{ color: '#111827' }}>
              {groupBuyName}
            </span>
          </div>
        </div>

        {/* Product card */}
        <div className="px-6 pb-4">
          <div
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <div
              className="w-16 h-16 rounded-xl overflow-hidden shrink-0"
              style={{ background: 'rgba(0, 0, 0, 0.05)' }}
            >
              {productImage ? (
                <img src={productImage} alt={productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Tag className="w-6 h-6" style={{ color: '#9CA3AF' }} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                {productName}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-bold" style={{ color: '#111827' }}>
                  ₦{discountedPrice.toLocaleString()}
                </span>
                <span className="text-xs line-through" style={{ color: '#9CA3AF' }}>
                  ₦{originalPrice.toLocaleString()}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: '#111827', color: '#FFFFFF' }}
                >
                  {discountPct}% OFF
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1" style={{ color: '#6B7280' }}>
              <Users className="w-3.5 h-3.5" />
              {currentCount} joined
            </span>
            <span style={{ color: '#6B7280' }}>{targetCount} needed</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(17, 24, 39, 0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((currentCount / targetCount) * 100, 100)}%`,
                background: '#111827',
              }}
            />
          </div>
        </div>

        {/* Shareable link box */}
        <div className="px-6 pb-3">
          <div
            className="flex items-center gap-2 p-2.5 rounded-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <input
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-xs outline-none truncate"
              style={{ color: '#6B7280' }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopyLink}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95"
              style={{
                background: copied ? '#111827' : 'rgba(17, 24, 39, 0.08)',
                color: copied ? '#FFFFFF' : '#111827',
              }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-3 flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition active:scale-[0.98]"
            style={{
              background: '#111827',
              color: '#FFFFFF',
              boxShadow: '0 6px 20px rgba(17, 24, 39, 0.3)',
            }}
          >
            <Share2 className="w-4 h-4" />
            Share Link
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 px-4 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition active:scale-[0.98]"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              color: '#111827',
            }}
            aria-label="View group buy page"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Social share buttons — WhatsApp, Instagram, TikTok */}
        <div className="px-6 pb-6">
          <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2 text-center">
            Share to social media
          </p>
          <div className="flex gap-2">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`🛍️ Join my group buy on Cellex! Get ${discountPct}% off ${productName}. Only ${targetCount} people needed. Join here: ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition active:scale-95"
              style={{ background: '#25D366', color: '#FFFFFF' }}
              aria-label="Share to WhatsApp"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span className="text-[9px] font-bold">WhatsApp</span>
            </a>
            {/* Instagram (copy link — IG doesn't support direct share URLs) */}
            <button
              onClick={() => {
                handleCopyLink();
                window.open('https://www.instagram.com/', '_blank');
              }}
              className="flex-1 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition active:scale-95"
              style={{ background: 'linear-gradient(45deg, #F09433 0%, #E6683C 25%, #DC2743 50%, #CC2366 75%, #BC1888 100%)', color: '#FFFFFF' }}
              aria-label="Share to Instagram"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              <span className="text-[9px] font-bold">Instagram</span>
            </button>
            {/* TikTok (copy link — TikTok doesn't support direct share URLs) */}
            <button
              onClick={() => {
                handleCopyLink();
                window.open('https://www.tiktok.com/', '_blank');
              }}
              className="flex-1 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition active:scale-95"
              style={{ background: '#000000', color: '#FFFFFF' }}
              aria-label="Share to TikTok"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>
              <span className="text-[9px] font-bold">TikTok</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a catchy, descriptive name for a group buy.
 * Examples:
 *   "iPhone 15 Pro Max Squad" (3+ target)
 *   "Wireless Earbuds Crew — 20% Off" (with discount)
 *   "Fresh Tomatoes 5kg Group Buy" (fallback)
 */
export function generateGroupBuyName(productName: string, discountPct: number, targetCount: number): string {
  const cleanName = (productName || 'Product').trim();
  // Pick a fun suffix based on target count
  const suffixes = ['Squad', 'Crew', 'Group', 'Deal', 'Bundle'];
  const suffix = suffixes[targetCount % suffixes.length] || 'Group';
  // Keep it under 50 chars
  const maxNameLen = 50 - suffix.length - 6; // 6 for " — " + "% Off"
  const truncatedName = cleanName.length > maxNameLen
    ? cleanName.slice(0, maxNameLen - 1).trim() + '…'
    : cleanName;
  return `${truncatedName} ${suffix}`;
}

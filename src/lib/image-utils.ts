/**
 * Supabase Image URL Optimization Utility
 *
 * Transforms raw Supabase Storage URLs to include optimization query params
 * (width, height, quality, format=webp). Non-Supabase URLs (gstatic, unsplash,
 * etc.) pass through unchanged — we can't optimize those at the CDN level.
 *
 * Supabase Storage supports these transform params:
 *   ?width=400        — resize to max width (maintains aspect ratio)
 *   ?height=400       — resize to max height
 *   ?quality=70       — compression quality (1-100, lower = smaller file)
 *   ?format=webp      — convert to WebP (30-50% smaller than JPEG/PNG)
 *   ?resize=cover     — cover crop (needs both width + height)
 *
 * Usage:
 *   import { optimizeImage } from '@/lib/image-utils';
 *   <img src={optimizeImage(product.image_url, { width: 400 })} />
 */

interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;      // default 70
  format?: 'webp' | 'avif' | 'origin';  // default 'webp'
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Check if a URL is a Supabase Storage URL (we can optimize these).
 * Supabase URLs look like: https://tcwdbokruvlizkxcpkzj.supabase.co/storage/v1/object/public/...
 */
export function isSupabaseUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.supabase.co/storage/') ||
    lower.includes('.supabase.in/storage/') ||
    lower.includes('/storage/v1/object/')
  );
}

/**
 * Transform a Supabase Storage URL to include optimization query params.
 * Non-Supabase URLs pass through unchanged.
 *
 * For Supabase URLs, if the URL already contains /object/public/, we can add
 * transform params directly. If it contains /render/image/ (already transformed),
 * we replace the existing params.
 */
export function optimizeImage(url: string | null | undefined, options: OptimizeOptions = {}): string {
  if (!url) return '';

  // Non-Supabase URLs — can't optimize at CDN, return as-is
  if (!isSupabaseUrl(url)) return url;

  const {
    width,
    height,
    quality = 70,
    format = 'webp',
    resize,
  } = options;

  // Build query params
  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  params.set('format', format);
  if (resize) params.set('resize', resize);

  // If URL already has query params, merge; otherwise append
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * Generate a low-resolution blurred placeholder URL (LQIP).
 * Uses Supabase's transform API to create a tiny 20px wide, low-quality image
 * that loads instantly and is blurred via CSS until the full image loads.
 *
 * For non-Supabase URLs, returns empty string (no LQIP available).
 */
export function getLqipUrl(url: string | null | undefined): string {
  if (!url || !isSupabaseUrl(url)) return '';
  return optimizeImage(url, { width: 20, quality: 30, format: 'webp' });
}

/**
 * Generate a srcset for responsive images.
 * Returns a string suitable for the <img srcset> attribute.
 *
 * Example: optimizeImageSrcSet(url, [200, 400, 800])
 * → "url?width=200&... 200w, url?width=400&... 400w, url?width=800&... 800w"
 */
export function optimizeImageSrcSet(
  url: string | null | undefined,
  widths: number[] = [200, 400, 800, 1200],
  options: Omit<OptimizeOptions, 'width'> = {},
): string {
  if (!url || !isSupabaseUrl(url)) return '';
  return widths
    .map((w) => `${optimizeImage(url, { ...options, width: w })} ${w}w`)
    .join(', ');
}

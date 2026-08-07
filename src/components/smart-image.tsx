'use client';

import { useState, useRef, useEffect } from 'react';
import { optimizeImage, getLqipUrl, isSupabaseUrl } from '@/lib/image-utils';

/**
 * SmartImage — high-performance image component with LQIP blur-up.
 *
 * Features:
 * 1. Native loading="lazy" (deferred loading until near viewport)
 * 2. Low-resolution blurred placeholder (LQIP) — loads a 20px wide image
 *    instantly, shows it blurred, then swaps to full-res when loaded
 * 3. Supabase URL optimization — auto-appends width/quality/format=webp
 * 4. Optional srcset for responsive images
 * 5. Decoding="async" for non-blocking render
 * 6. Fade-in transition when full image loads
 *
 * Usage:
 *   <SmartImage src={product.image_url} alt={product.name} width={400} />
 *   <SmartImage src={url} alt="..." width={800} heights={[200,400,800]} />
 */

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  /** Target display width — used for optimization (Supabase URLs only) */
  width?: number;
  /** Optional height for optimization */
  height?: number;
  /** Responsive widths for srcset (e.g. [200, 400, 800]) */
  widths?: number[];
  /** Quality 1-100 (default 70) */
  quality?: number;
  /** CSS classes for the <img> */
  className?: string;
  /** Style for the <img> */
  style?: React.CSSProperties;
  /** onClick handler */
  onClick?: () => void;
  /** Whether to use LQIP blur placeholder (default true, only works for Supabase URLs) */
  blur?: boolean;
  /** Loading strategy — default 'eager' so images load immediately
   * (browser serves from HTTP cache on return visits — no delay) */
  loading?: 'lazy' | 'eager';
}

export function SmartImage({
  src,
  alt,
  width,
  height,
  widths,
  quality = 70,
  className = '',
  style,
  onClick,
  blur = true,
  loading = 'eager',
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Optimize the main image URL (Supabase only — others pass through)
  const optimizedSrc = src ? optimizeImage(src, { width, height, quality }) : '';
  const lqipSrc = src && blur ? getLqipUrl(src) : '';

  // Build srcset for responsive images
  const srcset = src && widths && widths.length > 0
    ? widths.map((w) => `${optimizeImage(src, { width: w, quality })} ${w}w`).join(', ')
    : undefined;

  // If the image is already cached (e.g. navigated back), it may load before
  // the onLoad handler attaches. Check complete state on mount.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (!src || error) {
    return (
      <div
        className={`shimmer ${className}`}
        style={{ ...style, minHeight: style?.minHeight || 100 }}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={style}
      onClick={onClick}
    >
      {/* LQIP blurred placeholder — loads instantly, fades out when full image loads */}
      {lqipSrc && !loaded && (
        <img
          src={lqipSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // hide blur edges
            transition: 'opacity 0.3s ease-out',
            opacity: 1,
          }}
        />
      )}

      {/* Main image — loads lazily, fades in when ready */}
      <img
        ref={imgRef}
        src={optimizedSrc}
        srcSet={srcset}
        sizes={widths ? `(max-width: 768px) 100vw, ${width || 400}px` : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`relative w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ ...style, objectFit: 'cover' }}
      />
    </div>
  );
}

export default SmartImage;

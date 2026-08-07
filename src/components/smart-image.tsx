'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { optimizeImage, getLqipUrl, isSupabaseUrl } from '@/lib/image-utils';

/**
 * SmartImage — high-performance image component with LQIP blur-up.
 *
 * KEY FIX: Uses useLayoutEffect (not useEffect) to detect cached images
 * SYNCHRONOUSLY before the browser paints. This eliminates the LQIP
 * placeholder flash on return visits — if the image is in the browser's
 * HTTP cache, loaded is set to true before paint, so the user sees the
 * full image immediately with no placeholder.
 *
 * Also checks performance.getEntriesByType('resource') as a secondary
 * cache detection method.
 */

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  widths?: number[];
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  blur?: boolean;
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

  const optimizedSrc = src ? optimizeImage(src, { width, height, quality }) : '';
  const lqipSrc = src && blur ? getLqipUrl(src) : '';

  const srcset = src && widths && widths.length > 0
    ? widths.map((w) => `${optimizeImage(src, { width: w, quality })} ${w}w`).join(', ')
    : undefined;

  // CRITICAL: useLayoutEffect fires BEFORE the browser paints.
  // If the image is already in the browser's cache (return visit), we set
  // loaded=true immediately so the user never sees the LQIP placeholder flash.
  useLayoutEffect(() => {
    if (!src) return;

    // Method 1: Check if the <img> element already has the image loaded.
    // Browsers decode cached images synchronously when src is set, so
    // imgRef.current.complete may already be true at this point.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
      return;
    }

    // Method 2: Check the Performance Resource Timing API.
    // If the browser has a resource entry for this URL, it's been loaded
    // before (cached) and will load instantly — skip the placeholder.
    try {
      const entries = performance.getEntriesByType('resource');
      const isCached = entries.some(
        (e) => e.name === optimizedSrc || e.name === src
      );
      if (isCached) {
        // Don't set loaded=true yet — the <img> hasn't decoded yet.
        // But we skip showing the LQIP by setting loaded=true after
        // a microtask (faster than paint).
        Promise.resolve().then(() => setLoaded(true));
      }
    } catch {}
  }, [src, optimizedSrc]);

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
      {/* LQIP blurred placeholder — only shows if image is NOT cached */}
      {lqipSrc && !loaded && (
        <img
          src={lqipSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: 1,
          }}
        />
      )}

      {/* Main image — fades in when ready (instant if cached) */}
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
        className={`relative w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ ...style, objectFit: 'cover' }}
      />
    </div>
  );
}

export default SmartImage;

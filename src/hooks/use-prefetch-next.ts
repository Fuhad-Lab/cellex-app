'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * usePrefetchNext — detects when user is near the end of a viewed item
 * and silently triggers a background fetch for the next media asset.
 *
 * Works for both images and videos. Uses the browser's native cache:
 * - For images: creates a new Image() object and sets src (browser caches it)
 * - For videos: creates a <link rel="preload"> element (browser caches metadata + first chunks)
 *
 * Usage:
 *   const { registerItem, currentIndex } = usePrefetchNext({
 *     items: feed,
 *     threshold: 0.7,  // prefetch when 70% scrolled
 *   });
 *
 *   // Register each feed item with its media URL
 *   {feed.map((item, i) => (
 *     <div key={item.id} ref={registerItem(i)}>
 *       <SmartImage src={item.image_url} />
 *     </div>
 *   ))}
 */

interface PrefetchOptions {
  /** Array of items (any shape — the hook only cares about length) */
  items: any[];
  /** Scroll threshold to trigger prefetch (0-1, default 0.7 = 70% visible) */
  threshold?: number;
  /** How many items ahead to prefetch (default 1) */
  prefetchCount?: number;
  /** Function to extract media URL from an item */
  getMediaUrl?: (item: any) => string;
  /** Media type — affects prefetch strategy */
  mediaType?: 'image' | 'video' | 'auto';
}

interface UsePrefetchNextReturn {
  /** Register a ref callback for each feed item by index */
  registerItem: (index: number) => (el: HTMLElement | null) => void;
  /** Currently visible item index */
  currentIndex: number;
  /** Manually trigger prefetch for a specific index */
  prefetch: (index: number) => void;
}

export function usePrefetchNext({
  items,
  threshold = 0.7,
  prefetchCount = 1,
  getMediaUrl,
  mediaType = 'auto',
}: PrefetchOptions): UsePrefetchNextReturn {
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const prefetchedRef = useRef<Set<number>>(new Set());

  // Register each item's DOM element
  const registerItem = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      if (el) {
        itemRefs.current.set(index, el);
      } else {
        itemRefs.current.delete(index);
      }
    };
  }, []);

  // Prefetch a single item's media URL
  const prefetch = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return;
    if (prefetchedRef.current.has(index)) return;
    prefetchedRef.current.add(index);

    const item = items[index];
    if (!item) return;

    const url = getMediaUrl ? getMediaUrl(item) : (item.image_url || item.video_url || item.mediaUrl);
    if (!url) return;

    // Determine media type
    const isVideo = mediaType === 'video' || (mediaType === 'auto' && (url.includes('.mp4') || url.includes('.webm') || url.includes('video')));

    if (isVideo) {
      // For videos: use <link rel="preload"> to cache metadata + first chunks
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      // Also create a video element to warm the cache
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      v.muted = true;
      // Abort after 2s — we just want to warm the cache, not download the whole video
      setTimeout(() => { v.src = ''; }, 2000);
    } else {
      // For images: create a new Image() to cache it
      const img = new Image();
      img.src = url;
      // For Supabase URLs, also prefetch a medium-quality version
      if (url.includes('supabase')) {
        const optimizedUrl = url + (url.includes('?') ? '&' : '?') + 'width=400&quality=70&format=webp';
        const img2 = new Image();
        img2.src = optimizedUrl;
      }
    }
  }, [items, getMediaUrl, mediaType]);

  // IntersectionObserver to track which item is currently in view
  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        let bestIndex = currentIndex;
        let bestRatio = threshold;

        entries.forEach((entry) => {
          if (entry.intersectionRatio >= bestRatio) {
            bestRatio = entry.intersectionRatio;
            // Extract index from data attribute
            const idx = parseInt(entry.target.getAttribute('data-prefetch-index') || '0', 10);
            bestIndex = idx;
          }
        });

        if (bestIndex !== currentIndex) {
          setCurrentIndex(bestIndex);

          // Prefetch the next N items
          for (let i = 1; i <= prefetchCount; i++) {
            prefetch(bestIndex + i);
          }
        }
      },
      { threshold: [threshold] },
    );

    // Observe all registered items
    itemRefs.current.forEach((el) => {
      el.setAttribute('data-prefetch-index', String(Array.from(itemRefs.current.keys()).find((k) => itemRefs.current.get(k) === el)));
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items, threshold, prefetchCount, currentIndex, prefetch]);

  return { registerItem, currentIndex, prefetch };
}

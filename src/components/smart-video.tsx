'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * SmartVideo — video component optimized for scrollable feeds.
 *
 * Features:
 * 1. preload="metadata" — only loads video metadata (duration, dimensions),
 *    NOT the full video. Prevents automatic heavy downloading.
 * 2. IntersectionObserver — auto-plays when video occupies 50%+ of viewport,
 *    auto-pauses when scrolled away. Saves bandwidth + CPU.
 * 3. Muted + playsInline — required for autoplay on iOS Safari + Android Chrome
 * 4. Poster placeholder — shows a static frame (or shimmer) until played
 * 5. Click to toggle play/pause
 *
 * Usage:
 *   <SmartVideo src={video.video_url} poster={video.thumbnail_url} />
 *   <SmartVideo src={url} onInView={() => trackView(video.id)} />
 */

interface SmartVideoProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  /** Called when the video enters the viewport (for view tracking) */
  onInView?: () => void;
  /** Called when the video exits the viewport */
  onOutOfView?: () => void;
  /** Intersection ratio threshold for autoplay (default 0.5 = 50% visible) */
  threshold?: number;
  /** Whether to autoplay when in view (default true) */
  autoPlay?: boolean;
  /** Whether to loop (default true for feed videos) */
  loop?: boolean;
}

export function SmartVideo({
  src,
  poster,
  className = '',
  style,
  onClick,
  onInView,
  onOutOfView,
  threshold = 0.5,
  autoPlay = true,
  loop = true,
}: SmartVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const inViewRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // IntersectionObserver — play when 50%+ visible, pause when scrolled away
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            if (!inViewRef.current) {
              inViewRef.current = true;
              onInView?.();
            }
            if (autoPlay) {
              video.play().catch(() => {
                // Autoplay was blocked (rare since we're muted, but just in case)
                setShowPlayIcon(true);
              });
            }
          } else {
            if (inViewRef.current) {
              inViewRef.current = false;
              onOutOfView?.();
            }
            video.pause();
          }
        });
      },
      { threshold: [threshold] },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [threshold, autoPlay, onInView, onOutOfView]);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setShowPlayIcon(false);
    } else {
      video.pause();
      setShowPlayIcon(true);
    }
    onClick?.();
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={style} onClick={togglePlay}>
      {/* Shimmer placeholder until video metadata loads */}
      {!loaded && (
        <div className="absolute inset-0 shimmer" />
      )}

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        loop={loop}
        playsInline
        preload="metadata"
        onLoadedMetadata={() => setLoaded(true)}
        onClick={togglePlay}
        className={`relative w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectFit: 'cover' }}
      />

      {/* Play icon overlay (shown when paused or autoplay blocked) */}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartVideo;

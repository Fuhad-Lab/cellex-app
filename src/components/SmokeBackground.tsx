'use client';

import React, { useRef, useEffect } from 'react';

/**
 * SmokeBackground — video-based smoke background.
 *
 * Uses a royalty-free smoke video (Mixkit) on a pure black background.
 * The video autoplays muted + looped + inline (iOS Safari compatible).
 * A radial vignette overlay darkens edges so white text pops cleanly.
 *
 * Playback speed is set to 0.25 (quarter speed) for a very slow, calm,
 * premium heavy smoke feel. The original video is 22s with fast motion;
 * at 0.25x it becomes ~90s per loop with slow, gentle drift.
 *
 * Video: /public/smoke-bg.mp4 (floating smoke on black, from Mixkit)
 */
export default function SmokeBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Set playback rate immediately
    v.playbackRate = 0.25;

    // Re-apply after metadata loads (browsers may reset)
    const onLoadedMetadata = () => {
      v.playbackRate = 0.25;
    };

    // Re-apply when playback begins (some browsers reset on play)
    const onPlay = () => {
      v.playbackRate = 0.25;
    };

    // Re-apply on each loop (some browsers reset on loop)
    const onTimeUpdate = () => {
      if (Math.abs(v.playbackRate - 0.25) > 0.01) {
        v.playbackRate = 0.25;
      }
    };

    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('play', onPlay);
    v.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,         // Ensures it sits completely behind HTML content
        overflow: 'hidden',
        background: '#000'  // Hard black color match while video initializes
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline         // Inline is absolutely mandatory for iOS Safari autoplay
        preload="auto"      // Encourages aggressive browser background caching
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.65,    // Slightly lowered opacity protects text readability
        }}
      >
        <source src="/smoke-bg.mp4" type="video/mp4" />
      </video>

      {/* Modern Vignette Overlay: Darkens the edges so white website text pops cleanly */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)',
          pointerEvents: 'none' // Allows clicking of items "through" the vignette layer
        }}
      />
    </div>
  );
}

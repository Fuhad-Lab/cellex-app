'use client';

import React from 'react';

/**
 * SmokeBackground — video-based smoke background.
 *
 * Uses a royalty-free smoke video (Mixkit) on a pure black background.
 * The video autoplays muted + looped + inline (iOS Safari compatible).
 * A radial vignette overlay darkens edges so white text pops cleanly.
 *
 * Replaces the FluidBackground (GLSL shader) which was too subtle to see.
 * This approach is simpler, more reliable, and produces real smoke footage.
 *
 * Video: /public/smoke-bg.mp4 (floating smoke on black, from Mixkit #8522)
 */
export default function SmokeBackground() {
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
        autoPlay
        loop
        muted
        playsInline         // Inline is absolutely mandatory for iOS Safari autoplay
        preload="auto"      // Encourages aggressive browser background caching
        // Slow down playback for a calm, premium, heavy smoke feel.
        // 0.5 = half speed (default 1.0 was too fast/jittery for a background).
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.65,    // Slightly lowered opacity protects text readability
        }}
        // playbackRate must be set via ref or onLoadedMetadata because the
        // <video> element doesn't accept it as a prop in React.
        ref={(el) => {
          if (el) {
            el.playbackRate = 0.5;
            // Re-apply after metadata loads (some browsers reset on load)
            el.onloadedmetadata = () => { el.playbackRate = 0.5; };
          }
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

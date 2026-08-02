'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Play, Pause, Volume2, Sparkles } from 'lucide-react';

interface StorefrontAvatarPlayerProps {
  sellerName: string;
  sellerImage?: string;
  script: string;
  audioUrl?: string;
  language?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  pcm: 'Nigerian Pidgin',
};

/**
 * StorefrontAvatarPlayer — plays the seller's AI talking avatar.
 *
 * Shows the seller's profile photo with an animated speaking indicator,
 * plays the AI-generated audio, and displays the script as subtitles.
 * This builds trust — buyers can hear the seller introduce their shop.
 */
export function StorefrontAvatarPlayer({
  sellerName,
  sellerImage,
  script,
  audioUrl,
  language = 'en',
}: StorefrontAvatarPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const langName = LANGUAGE_NAMES[language] || 'English';

  const togglePlay = () => {
    if (!audioUrl) {
      // No audio — just toggle the "speaking" animation for text-only mode
      setPlaying(!playing);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (!script) return null;

  return (
    <section style={{ padding: '0 16px', marginTop: '16px' }}>
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
          padding: '20px',
        }}
      >
        {/* Badge */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
        >
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-[10px] font-semibold text-white">AI Avatar</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Avatar with speaking animation */}
          <button
            onClick={togglePlay}
            className="relative shrink-0 transition active:scale-95"
            aria-label={playing ? 'Pause avatar' : 'Play avatar'}
          >
            {/* Pulsing ring when playing */}
            {playing && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'rgba(212, 175, 55, 0.4)',
                  animation: 'pulse-ring 1.5s ease-out infinite',
                }}
              />
            )}

            {/* Avatar image */}
            <div
              className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                border: '3px solid rgba(255,255,255,0.3)',
                background: '#374151',
              }}
            >
              {sellerImage ? (
                <img src={sellerImage} alt={sellerName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {(sellerName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Play/pause overlay */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center transition"
              style={{
                background: playing ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
              }}
            >
              {playing ? (
                <Pause className="w-6 h-6 text-white" fill="white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
              )}
            </div>
          </button>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Mic className="w-3 h-3 text-[#D4AF37]" />
              <span className="text-[10px] font-semibold text-[#D4AF37] uppercase tracking-wide">
                Meet {sellerName} · {langName}
              </span>
            </div>
            <p
              className="text-white text-sm leading-relaxed"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: playing ? 'unset' : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              "{script}"
            </p>
          </div>
        </div>

        {/* Audio element (if available) */}
        {audioUrl && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <Volume2 className="w-3.5 h-3.5 text-white/60" />
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4AF37] rounded-full transition-all"
                style={{ width: playing ? '100%' : '0%', transitionDuration: '3s' }}
              />
            </div>
            <span className="text-[10px] text-white/60">
              {playing ? 'Speaking...' : 'Tap to play'}
            </span>
          </div>
        )}

        {/* CSS for pulse animation */}
        <style jsx>{`
          @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
          }
        `}</style>
      </div>
    </section>
  );
}

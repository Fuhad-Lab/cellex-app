'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Mic, Play, Pause, Check, Loader2, AlertCircle, Languages } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SellerAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerName?: string;
  onSaved?: () => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'pcm', name: 'Nigerian Pidgin', flag: '🇳🇬' },
];

const SCRIPT_SUGGESTIONS = [
  "Hello! Welcome to my shop. I sell quality products at the best prices. Buy with confidence — fast delivery and 100% guaranteed.",
  "Welcome! I'm passionate about bringing you the best products. Every item is carefully selected. Thank you for supporting my business!",
  "Hi there! I've been selling on Cellex for months. Trust me with your order — I deliver quality products and excellent customer service.",
];

export function SellerAvatarModal({ isOpen, onClose, sellerName, onSaved }: SellerAvatarModalProps) {
  const [script, setScript] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [existingAvatar, setExistingAvatar] = useState<{ script: string; language: string; audioUrl: string; hasAvatar: boolean } | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadExistingAvatar();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      if (audioEl) { audioEl.pause(); setPlaying(false); }
    } else {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const loadExistingAvatar = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/seller-avatar`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get' }),
      });
      const data = await resp.json();
      if (data.success && data.avatar) {
        setExistingAvatar(data.avatar);
        if (data.avatar.script) setScript(data.avatar.script);
        if (data.avatar.language) setLanguage(data.avatar.language);
      }
    } catch {}
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!script.trim()) {
      toast({ title: 'Please write a script', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const resp = await fetch(`${API_BASE}/api/seller-avatar`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'generate', script, language }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Avatar created!', description: data.message });
        setExistingAvatar(data.avatar);
        if (onSaved) onSaved();
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const togglePlayAudio = () => {
    if (!existingAvatar?.audioUrl) return;
    if (!audioEl) {
      const el = new Audio(existingAvatar.audioUrl);
      el.onended = () => setPlaying(false);
      setAudioEl(el);
      el.play();
      setPlaying(true);
    } else {
      if (playing) { audioEl.pause(); setPlaying(false); }
      else { audioEl.play(); setPlaying(true); }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#111827] btn-ripple  flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#111827]">AI Seller Avatar</h2>
              <p className="text-[10px] text-[#6B7280]">Build trust with a talking avatar on your storefront</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center transition" aria-label="Close">
            <X className="w-4 h-4 text-[#111827]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 70px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#111827]" />
            </div>
          ) : (
            <>
              {/* Why this matters */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD]">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
                <p className="text-xs text-[#0C4A6E]">
                  Buyers who hear you introduce your shop are 3x more likely to trust you and buy.
                  Write a short intro, pick your language, and your avatar will appear on your storefront.
                </p>
              </div>

              {/* Language selector */}
              <div>
                <label className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-[#6B7280]">
                  <Languages className="w-3.5 h-3.5" />
                  LANGUAGE
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`px-3 py-2 rounded-full text-xs font-semibold transition ${
                        language === lang.code
                          ? 'bg-[#111827] text-white'
                          : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script input */}
              <div>
                <label className="text-xs font-semibold mb-2 block text-[#6B7280]">
                  YOUR INTRODUCTION SCRIPT
                  <span className="font-normal text-[#9CA3AF] ml-1">({script.length}/500)</span>
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value.slice(0, 500))}
                  placeholder="Hello! Welcome to my shop. I sell quality products at the best prices..."
                  rows={4}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] card-premium  rounded-xl p-3 text-sm text-[#111827] outline-none focus:border-[#111827] focus:bg-white transition resize-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SCRIPT_SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setScript(s)}
                      className="text-[10px] px-2 py-1 rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] transition"
                    >
                      Suggestion {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview existing avatar */}
              {existingAvatar?.hasAvatar && existingAvatar?.audioUrl && (
                <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span className="text-xs font-semibold text-[#15803D]">Avatar is live on your storefront</span>
                  </div>
                  <button
                    onClick={togglePlayAudio}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#BBF7D0] text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition"
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {playing ? 'Pause preview' : 'Play preview'}
                  </button>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !script.trim()}
                className="w-full h-12 rounded-xl bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating avatar...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {existingAvatar?.hasAvatar ? 'Update Avatar' : 'Create My Avatar'}
                  </>
                )}
              </button>

              <p className="text-[10px] text-[#9CA3AF] text-center">
                Your avatar will auto-play on your storefront. Buyers can hear you introduce your shop.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

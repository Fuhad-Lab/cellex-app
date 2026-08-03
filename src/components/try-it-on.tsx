'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Upload, X, Loader2, Download, RefreshCw, ZoomIn, ZoomOut, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface TryItOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productCategory: string;
  productImage?: string;
}

type Status = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';

// Map product categories to FASHN categories
function getFashnCategory(productCategory: string): string {
  const cat = (productCategory || '').toLowerCase();
  if (cat.includes('pant') || cat.includes('jean') || cat.includes('trouser') || cat.includes('short') || cat.includes('skirt')) {
    return 'bottoms';
  }
  if (cat.includes('dress') || cat.includes('gown') || cat.includes('jumpsuit') || cat.includes('onepiece')) {
    return 'one-pieces';
  }
  // Default to tops for shirts, jackets, etc.
  return 'tops';
}

export function TryItOnModal({ isOpen, onClose, productName, productCategory, productImage }: TryItOnModalProps) {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showSlider, setShowSlider] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // Elapsed time tracker during generation
  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [generating]);

  // Simulate status progression for UX (actual status comes from the API response)
  useEffect(() => {
    if (!generating) return;
    // Show "Uploading" → "Queued" → "Processing" progression
    const timers: NodeJS.Timeout[] = [];
    setStatus('uploading');
    setStatusMessage('Uploading your photo...');
    timers.push(setTimeout(() => {
      setStatus('queued');
      setStatusMessage('Queued on ZeroGPU...');
    }, 2000));
    timers.push(setTimeout(() => {
      setStatus('processing');
      setStatusMessage('Generating try-on result...');
    }, 8000));
    return () => timers.forEach(t => clearTimeout(t));
  }, [generating]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUserImage(null);
      setResultImage(null);
      setError('');
      setStatus('idle');
      setZoom(1);
      setGenerating(false);
    }
  }, [isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Max 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setUserImage(reader.result as string);
      setResultImage(null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!userImage || !productImage) return;
    setGenerating(true);
    setError('');
    setResultImage(null);
    setStatus('uploading');
    setStatusMessage('Uploading your photo...');

    try {
      // Phase 1: Start the try-on job (returns immediately with jobId)
      const startResp = await fetch(`${API_BASE}/api/try-on`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userImage,
          productImage,
          category: getFashnCategory(productCategory),
          photoType: 'model',
        }),
      });

      const startData = await startResp.json();
      if (!startData.success || !startData.jobId) {
        throw new Error(startData.error || 'Failed to start try-on');
      }

      const jobId = startData.jobId;

      // Phase 2: Poll for the result every 3 seconds (CPU inference takes longer)
      const maxPolls = 120; // 120 * 3s = 360s (6 min) max — CPU is slower
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const pollResp = await fetch(`${API_BASE}/api/try-on?jobId=${jobId}`, {
          credentials: 'include',
        });
        const pollData = await pollResp.json();

        if (!pollData.success) {
          throw new Error(pollData.error || 'Job not found');
        }

        if (pollData.status === 'done' && pollData.image) {
          setStatus('done');
          setStatusMessage('Done!');
          setResultImage(pollData.image);
          setZoom(1);
          setGenerating(false);
          return;
        }

        if (pollData.status === 'error') {
          throw new Error(pollData.error || 'Generation failed');
        }

        // Update status based on the job's actual status
        if (pollData.status === 'uploading') {
          setStatus('uploading');
          setStatusMessage('Uploading your photo...');
        } else if (pollData.status === 'processing') {
          setStatus('processing');
          setStatusMessage('Generating try-on result...');
        } else if (pollData.status === 'queued') {
          setStatus('queued');
          setStatusMessage('Queued on ZeroGPU...');
        }
      }

      throw new Error('Timed out — CPU inference is slow. Please try again.');
    } catch (err) {
      setStatus('error');
      setStatusMessage('');
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    }
    setGenerating(false);
  };

  const reset = () => {
    setUserImage(null);
    setResultImage(null);
    setError('');
    setStatus('idle');
    setZoom(1);
  };

  const retry = () => {
    setError('');
    setStatus('idle');
    generate();
  };

  // Before/after slider drag handling
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pct)));
  }, []);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleSliderMove(e.clientX);
    const onMove = (ev: MouseEvent) => handleSliderMove(ev.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    handleSliderMove(e.touches[0].clientX);
    const onMove = (ev: TouchEvent) => handleSliderMove(ev.touches[0].clientX);
    const onUp = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  };

  if (!isOpen) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#111827]">Virtual Try-On</h2>
              <p className="text-[10px] text-[#6B7280]">Powered by FASHN VTON v1.5 · ZeroGPU</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center transition" aria-label="Close">
            <X className="w-4 h-4 text-[#111827]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 70px)' }}>
          {/* Product context */}
          <div className="flex items-center gap-3 bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
            {productImage && (
              <img src={productImage} alt={productName} className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-[#111827] truncate">{productName}</div>
              <div className="text-xs text-[#6B7280]">{productCategory || 'Fashion'} · {getFashnCategory(productCategory)}</div>
            </div>
          </div>

          {/* Result image with before/after slider */}
          {resultImage && (
            <div className="space-y-3">
              {/* View toggle: Slider / Result only */}
              <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-full p-1">
                <button
                  onClick={() => setShowSlider(true)}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition ${showSlider ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
                >
                  Before / After
                </button>
                <button
                  onClick={() => setShowSlider(false)}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition ${!showSlider ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
                >
                  Result
                </button>
              </div>

              {/* Image display area */}
              <div
                ref={sliderRef}
                className="relative w-full rounded-2xl overflow-hidden bg-[#F3F4F6] select-none"
                style={{ aspectRatio: '3/4', cursor: showSlider ? 'ew-resize' : 'default' }}
                onMouseDown={showSlider ? handleSliderMouseDown : undefined}
                onTouchStart={showSlider ? handleSliderTouchStart : undefined}
              >
                {/* Result image (background, full width) */}
                <img
                  src={resultImage}
                  alt="Try-on result"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                  draggable={false}
                />

                {/* Before image (clipped to slider position) */}
                {showSlider && userImage && (
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPos}%` }}
                  >
                    <img
                      src={userImage}
                      alt="Your photo"
                      className="absolute inset-0 h-full object-cover"
                      style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: 'none', transform: `scale(${zoom})`, transformOrigin: 'left center' }}
                      draggable={false}
                    />
                  </div>
                )}

                {/* Slider handle */}
                {showSlider && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                    style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <div className="flex items-center">
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M2 1L1 7L2 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" className="-ml-1"><path d="M8 1L9 7L8 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Labels */}
                {showSlider && (
                  <>
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">Before</div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">After</div>
                  </>
                )}

                {/* Zoom controls */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button
                    onClick={() => setZoom(z => Math.max(1, z - 0.25))}
                    className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                    className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={retry}
                  className="flex-1 h-11 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] text-sm font-semibold hover:bg-[#F9FAFB] transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
                <a
                  href={resultImage}
                  download={`try-on-${productName.replace(/[^a-zA-Z0-9]/g, '_')}.png`}
                  className="flex-1 h-11 rounded-xl bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            </div>
          )}

          {/* Upload area (when no result) */}
          {!resultImage && !generating && (
            <>
              {userImage ? (
                <div className="relative">
                  <img src={userImage} alt="Your photo" className="w-full rounded-2xl max-h-72 object-cover" />
                  <button
                    onClick={() => setUserImage(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center transition hover:bg-black/80"
                    aria-label="Remove photo"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">Your photo</div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#E5E7EB] rounded-2xl p-8 hover:border-[#111827] hover:bg-[#F9FAFB] transition flex flex-col items-center gap-2"
                >
                  <div className="w-14 h-14 rounded-full bg-[#F3F4F6] flex items-center justify-center">
                    <Upload className="w-7 h-7 text-[#6B7280]" />
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">Upload your photo</span>
                  <span className="text-xs text-[#6B7280]">A clear, full-body photo works best</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Generation failed</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {userImage && (
                <button
                  onClick={generate}
                  className="w-full h-12 rounded-xl bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Try-On
                </button>
              )}
            </>
          )}

          {/* Loading state with status updates */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-10">
              {/* Animated loader */}
              <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-[#F3F4F6]" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-[#111827] border-t-transparent animate-spin"
                  style={{ animationDuration: '1s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  {status === 'uploading' && <Upload className="w-7 h-7 text-[#111827]" />}
                  {status === 'queued' && <Clock className="w-7 h-7 text-[#111827]" />}
                  {status === 'processing' && <Sparkles className="w-7 h-7 text-[#111827]" />}
                </div>
              </div>

              {/* Status message */}
              <div className="flex items-center gap-2 mb-1">
                {status === 'uploading' && <Upload className="w-4 h-4 text-[#6B7280]" />}
                {status === 'queued' && <Clock className="w-4 h-4 text-[#6B7280]" />}
                {status === 'processing' && <Sparkles className="w-4 h-4 text-[#6B7280]" />}
                <p className="text-sm font-semibold text-[#111827]">{statusMessage}</p>
              </div>
              <p className="text-xs text-[#6B7280] mb-3">
                FASHN VTON v1.5 · ZeroGPU inference
              </p>

              {/* Elapsed time */}
              <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                <span className="font-mono">{formatTime(elapsed)}</span>
                <span>·</span>
                <span>Timeout in {formatTime(Math.max(0, 180 - elapsed))}</span>
              </div>

              {/* Status steps */}
              <div className="flex items-center gap-1 mt-4">
                {[
                  { key: 'uploading', label: 'Upload', icon: Upload },
                  { key: 'queued', label: 'Queue', icon: Clock },
                  { key: 'processing', label: 'Generate', icon: Sparkles },
                ].map((step, i) => {
                  const stepOrder = ['uploading', 'queued', 'processing', 'done'];
                  const currentIdx = stepOrder.indexOf(status);
                  const stepIdx = stepOrder.indexOf(step.key);
                  const isDone = currentIdx > stepIdx;
                  const isCurrent = status === step.key;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                          isDone ? 'bg-[#111827] text-white' :
                          isCurrent ? 'bg-[#111827] text-white animate-pulse' :
                          'bg-[#F3F4F6] text-[#9CA3AF]'
                        }`}
                      >
                        {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      {i < 2 && <div className={`w-6 h-0.5 ${isDone ? 'bg-[#111827]' : 'bg-[#F3F4F6]'}`} />}
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-[#9CA3AF] mt-3 max-w-xs text-center">
                ZeroGPU uses a shared GPU. Queue times may vary (30-120s).
              </p>
            </div>
          )}

          {/* Error state with retry */}
          {!generating && error && !resultImage && userImage && (
            <button
              onClick={retry}
              className="w-full h-11 rounded-xl bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}

          {/* Privacy note */}
          <p className="text-[10px] text-[#9CA3AF] text-center pt-2 border-t border-[#F3F4F6]">
            Your photo is processed securely via Hugging Face ZeroGPU and is not stored.
          </p>
        </div>
      </div>
    </div>
  );
}

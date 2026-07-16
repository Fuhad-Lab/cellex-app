'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Upload, X, Loader2, Download, RefreshCw } from 'lucide-react';

interface TryItOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productCategory: string;
  productImage?: string;
}

export function TryItOnModal({ isOpen, onClose, productName, productCategory, productImage }: TryItOnModalProps) {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    if (!userImage) return;
    setGenerating(true);
    setError('');
    setResultImage(null);

    try {
      // Build a contextual prompt based on the product category
      let prompt = '';
      const cat = (productCategory || '').toLowerCase();

      if (cat.includes('fashion') || cat.includes('clothing')) {
        prompt = `A person wearing ${productName}, photorealistic, commercial fashion photography, full body shot, studio lighting, the person is posing naturally wearing this outfit`;
      } else if (cat.includes('beauty') || cat.includes('cosmetic')) {
        prompt = `A person applying/wearing ${productName}, photorealistic, beauty editorial photography, close-up face shot, studio lighting, natural makeup look`;
      } else if (cat.includes('accessor') || cat.includes('watch') || cat.includes('jewelry') || cat.includes('bag')) {
        prompt = `A person holding/wearing ${productName}, photorealistic, commercial product photography, the person is showcasing the product naturally, studio lighting`;
      } else if (cat.includes('shoe') || cat.includes('sneaker')) {
        prompt = `A person wearing ${productName} on their feet, photorealistic, commercial photography, full body shot showing the shoes, studio lighting`;
      } else if (cat.includes('phone') || cat.includes('electronic') || cat.includes('gadget')) {
        prompt = `A person holding ${productName} in their hand, photorealistic, commercial product photography, natural pose, studio lighting`;
      } else {
        prompt = `A person with ${productName}, photorealistic, commercial photography, natural pose, studio lighting, high quality`;
      }

      const resp = await fetch('/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userImage,
          productPrompt: prompt,
          productName,
          productCategory,
        }),
      });

      const data = await resp.json();
      if (data.success && data.image) {
        setResultImage(data.image);
      } else {
        setError(data.error || 'Generation failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setGenerating(false);
  };

  const reset = () => {
    setUserImage(null);
    setResultImage(null);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <Card
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Try It On</h2>
              <p className="text-[10px] text-slate-500">AI-powered virtual try-on</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Product context */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
            {productImage && (
              <img src={productImage} alt={productName} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{productName}</div>
              <div className="text-xs text-slate-500">{productCategory}</div>
            </div>
          </div>

          {/* Result image (if generated) */}
          {resultImage && (
            <div className="relative">
              <img src={resultImage} alt="Try-on result" className="w-full rounded-2xl" />
              <div className="flex gap-2 mt-2">
                <Button onClick={reset} variant="outline" className="flex-1 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" /> Try Again
                </Button>
                <a
                  href={resultImage}
                  download={`try-on-${productName}.png`}
                  className="flex-1"
                >
                  <Button className="w-full bg-black text-white text-xs">
                    <Download className="w-3 h-3 mr-1" /> Save Image
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Upload area (when no result) */}
          {!resultImage && (
            <>
              {userImage ? (
                <div className="relative">
                  <img src={userImage} alt="Your photo" className="w-full rounded-2xl max-h-64 object-cover" />
                  <button
                    onClick={() => setUserImage(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-black transition-colors flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Upload your photo</span>
                  <span className="text-xs text-slate-400">Clear face photo works best</span>
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
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg">{error}</div>
              )}

              {userImage && !generating && (
                <Button onClick={generate} className="w-full bg-black text-white h-12">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Try-On
                </Button>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-black mb-3" />
                  <p className="text-sm font-bold">Generating your try-on...</p>
                  <p className="text-xs text-slate-500 mt-1">This takes ~10-15 seconds</p>
                </div>
              )}
            </>
          )}

          {/* Privacy note */}
          <p className="text-[10px] text-slate-400 text-center">
            Your photo is processed securely and not stored. Results are AI-generated.
          </p>
        </div>
      </Card>
    </div>
  );
}

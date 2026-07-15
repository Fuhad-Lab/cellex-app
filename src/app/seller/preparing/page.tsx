'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Store, Loader2, Check, Sparkles } from 'lucide-react';

/**
 * SellerPreparingPage — shown after a user submits the become-a-seller form.
 *
 * Displays "Hold on, while we redesign your dashboard" with an animated
 * progress indicator. After ~3 seconds, redirects to the seller dashboard.
 */
export default function SellerPreparingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);

  const steps = [
    'Creating your store...',
    'Setting up your dashboard...',
    'Preparing product tools...',
    'Almost there...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => router.push('/seller'), 500);
          return 100;
        }
        return next;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(stepInterval);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 max-w-md mx-auto">
      <motion.div
        className="w-24 h-24 rounded-3xl bg-black flex items-center justify-center mb-8"
        animate={{ scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Store className="w-12 h-12 text-white" />
      </motion.div>

      <h1 className="text-2xl font-bold text-center mb-2">
        Hold on, while we redesign your dashboard
      </h1>
      <p className="text-sm text-slate-500 text-center mb-8">
        We&apos;re setting up your seller tools and preparing your store.
      </p>

      <div className="w-full mb-4">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-black rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600 mb-8">
        {step < steps.length - 1 ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{steps[step]}</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4 text-green-500" />
            <span className="font-medium">Ready!</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Sparkles className="w-3 h-3" />
        <span>Welcome to Cellex Selling</span>
        <Sparkles className="w-3 h-3" />
      </div>

      <Link href="/seller" className="mt-8 text-xs text-slate-400 underline">
        Skip to dashboard
      </Link>
    </div>
  );
}

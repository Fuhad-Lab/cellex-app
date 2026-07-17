'use client';

import { useState, useEffect , Suspense} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { PageSkeleton } from '@/components/page-skeleton';
function LoginContent() {
  const { user, login, signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // SECURITY: Validate the `next` parameter to prevent open redirect attacks.
  // Only allow relative paths (must start with "/" but not "//" which is a
  // protocol-relative URL that browsers treat as absolute).
  // Reject anything that looks like a URL scheme (e.g. "https://evil.com").
  const rawNext = searchParams.get('next') || '/';
  const isSafeRedirect = (path: string): boolean => {
    if (!path.startsWith('/')) return false;
    if (path.startsWith('//')) return false;  // protocol-relative URL
    if (path.startsWith('/\\')) return false; // backslash trick
    return true;
  };
  const next = isSafeRedirect(rawNext) ? rawNext : '/';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = mode === 'login'
      ? await login(email, password)
      : await signup(email, password);
    setLoading(false);
    if (result.success) {
      router.push(next);
    } else {
      setError(result.error || 'Authentication failed');
    }
  };

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400 outline-none";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-md space-y-6">
        {/* Top bar back button */}
        {next !== '/' && (
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center text-xs text-neutral-500 hover:text-black"
          >
            <ChevronLeft className="w-4 h-4" /> Back to home
          </button>
        )}

        {/* Logo header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-black" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Cellex
          </h1>
          <p className="text-sm text-neutral-500 mt-2">Nigeria&apos;s #1 social marketplace</p>
        </div>

        <div className="border border-neutral-200 rounded-md p-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-md mb-5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                mode === 'login' ? 'bg-white shadow text-black' : 'text-neutral-500'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                mode === 'signup' ? 'bg-white shadow text-black' : 'text-neutral-500'
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-neutral-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`pl-9 ${inputClass}`}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-neutral-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={`pl-9 ${inputClass}`}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              ) : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-neutral-400">
            By continuing, you agree to Cellex&apos;s Terms & Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="login" />}>
      <LoginContent />
    </Suspense>
  );
}


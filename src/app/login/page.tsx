'use client';

import { useState, useEffect , Suspense} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Mail, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-cyan-50 via-white to-white">
      <div className="w-full max-w-md space-y-6">
        {/* Logo header */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl brand-gradient glow mb-3"
            style={{ fontFamily: 'var(--font-geist-mono)' }}
          >
            <span className="text-white font-extrabold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-extrabold brand-text" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Cellex
          </h1>
          <p className="text-sm text-slate-500 mt-1">Nigeria's #1 social marketplace</p>
        </div>

        <Card className="p-6 shadow-lg border-slate-100">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'login' ? 'bg-white shadow text-primary' : 'text-slate-500'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'signup' ? 'bg-white shadow text-primary' : 'text-slate-500'
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-600">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-600">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="pl-9"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full brand-gradient text-primary-foreground font-bold">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? 'Login' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-slate-400">
            By continuing, you agree to Cellex's Terms & Privacy Policy
          </div>
        </Card>

        <div className="bg-gradient-to-r from-cyan-50 to-violet-50 border border-cyan-100 rounded-xl p-4 text-center">
          <Sparkles className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-slate-700">
            <span className="font-bold">AI Shopping:</span> Try our AI assistant after login — find products by chatting naturally.
          </p>
          <Link href="/ai-chat" className="text-xs font-bold text-primary hover:underline mt-1 inline-block">
            Explore AI →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}


'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ChevronLeft, User, Camera, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';

function LoginContent() {
  const { user, login, signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

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
  const [fullName, setFullName] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setProfileImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setProfileImageFile(null);
    setProfileImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Uploads the selected profile picture (if any) to /api/upload-image.
   * Returns the resulting image URL (e.g. "/api/image?id=<uuid>") or null on failure.
   *
   * This MUST be called AFTER successful signup, because /api/upload-image
   * requires an authenticated session cookie.
   */
  const uploadProfilePicture = async (): Promise<string | null> => {
    if (!profileImageFile) return null;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(profileImageFile);
      });

      const resp = await fetch(`${API_BASE}/api/upload-image`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No productId — this is a profile picture, not a product image.
          // The upload-image route stores it in product_images with product_id=NULL
          // and returns a /api/image?id=<uuid> URL we can save to the user profile.
          imageData: dataUrl,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        return data.imageUrl as string;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate signup-specific fields
    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name');
        return;
      }
    }

    setLoading(true);

    // 1. Sign up the user (creates auth account + sets session cookie)
    const result = mode === 'login'
      ? await login(email, password)
      : await signup(email, password);

    if (!result.success) {
      setLoading(false);
      setError(result.error || 'Authentication failed');
      return;
    }

    // 2. For signup mode: upload profile picture (if selected) and save profile
    //    data (fullName + profileImage URL) to the user's profile.
    if (mode === 'signup') {
      try {
        let profileImageUrl: string | null = null;

        // Upload the image FIRST (requires auth session cookie, which is now set).
        if (profileImageFile) {
          profileImageUrl = await uploadProfilePicture();
          if (!profileImageUrl) {
            // Don't fail the whole signup just because the image upload failed —
            // we still created the account. Show a non-blocking toast.
            toast({
              title: 'Profile picture upload failed',
              description: 'Your account was created but we couldn\'t upload your photo. You can add it later in Settings.',
              variant: 'destructive',
            });
          }
        }

        // Save the profile data (name + image URL).
        // If image upload failed, we still save the fullName.
        const profileResult = await api.profile.update({
          fullName: fullName.trim(),
          ...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
        });

        if (!profileResult.success) {
          // Non-fatal — account was created, profile data will be editable later.
          toast({
            title: 'Profile setup incomplete',
            description: 'Your account was created but we couldn\'t save your profile details. You can complete it in Settings.',
            variant: 'destructive',
          });
        }
      } catch {
        // Non-fatal — account was created.
      }
    }

    setLoading(false);
    router.push(next);
  };

  const inputClass = "w-full bg-[#F5F5F5] border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm focus:bg-[#F5F5F5] focus:border-[#E5E5E5] outline-none";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Top bar back button */}
        {next !== '/' && (
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center text-xs text-[#666666] hover:text-black"
          >
            <ChevronLeft className="w-4 h-4" /> Back to home
          </button>
        )}

        {/* Logo header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-black" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Cellex
          </h1>
          <p className="text-sm text-[#666666] mt-2">Nigeria&apos;s #1 social marketplace</p>
        </div>

        <div className="border border-[#E5E5E5] rounded-md p-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F5] rounded-md mb-5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                mode === 'login' ? 'bg-[#F5F5F5] shadow text-black' : 'text-[#666666]'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                mode === 'signup' ? 'bg-[#F5F5F5] shadow text-black' : 'text-[#666666]'
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Signup-only fields: profile picture + full name */}
            {mode === 'signup' && (
              <>
                {/* Profile picture upload — circular avatar with camera overlay */}
                <div className="flex flex-col items-center gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-24 h-24 rounded-full bg-[#F5F5F5] border-2 border-dashed border-white/15 hover:border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors flex items-center justify-center overflow-hidden group"
                    aria-label="Upload profile picture"
                  >
                    {profileImagePreview ? (
                      <>
                        <img src={profileImagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="w-6 h-6 text-black" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[#666666]">
                        <Camera className="w-7 h-7" />
                        <span className="text-[10px] font-medium">Add photo</span>
                      </div>
                    )}
                  </button>

                  {/* Change / remove buttons when an image is selected */}
                  {profileImagePreview && (
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sky-500 font-semibold hover:text-sky-700"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-[#666666] font-medium hover:text-red-500 inline-flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(file);
                    }}
                  />
                </div>

                {/* Full name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-[#666666]">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
                    <Input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ada Okonkwo"
                      className={`pl-9 ${inputClass}`}
                      autoComplete="name"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#666666]">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`pl-9 ${inputClass}`}
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-[#666666]">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={`pl-9 ${inputClass}`}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-200 text-red-700 text-xs rounded-md p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D4AF37] text-black font-semibold rounded-md py-3 hover:bg-[#F5F5F5] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-[#666666]">
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

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2, Phone, Check, Clock, Trash2, MessageCircle, ChevronLeft } from 'lucide-react';
import InternalLink from '@/components/internal-link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

import { useScrollPreservation } from '@/components/global-state-provider';
// WhatsApp bot number is read from env var (NEXT_PUBLIC_WHATSAPP_BOT_NUMBER)
// so it's not hardcoded in the client bundle.
const WHATSAPP_BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER || '';

export default function LinkAccountPage() {
  useScrollPreservation('link-account');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [links, setLinks] = useState<any[]>([]);

  const loadLinks = async () => {
    const result = await api.crossPlatform.myPhoneLinks();
    if (result.success) setLinks(result.links || []);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/link-account');
      return;
    }
    if (user) loadLinks();
  }, [user, authLoading, router]);

  const generateCode = async () => {
    if (!phone || phone.length < 10) {
      toast({ title: 'Invalid phone', description: 'Enter a valid phone number', variant: 'destructive' });
      return;
    }
    setLoadingCode(true);
    const result = await api.crossPlatform.generateLinkCode(phone);
    setLoadingCode(false);
    if (result.success && result.linkCode) {
      setLinkCode(result.linkCode);
      toast({ title: 'Code generated!', description: 'Send it to our WhatsApp bot' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const unlink = async (phoneNumber: string) => {
    if (!confirm('Unlink this phone number?')) return;
    const result = await api.crossPlatform.unlinkPhone(phoneNumber);
    if (result.success) {
      toast({ title: 'Unlinked' });
      loadLinks();
    }
  };

  if (authLoading) { return <PageSkeleton variant="link-account" />; }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm focus:bg-white/10 focus:border-white/10 outline-none";

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.push('/profile', { scroll: false })} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Link WhatsApp</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Intro */}
        <div className="flex items-start gap-2">
          <MessageCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-semibold mb-1">Shop without opening the app!</p>
            <p className="text-xs">
              Link your WhatsApp number to your Cellex account and shop by chatting with our bot.
              Your cart stays synced across WhatsApp and the web app.
            </p>
          </div>
        </div>

        {/* Generate code */}
        {!linkCode ? (
          <div className="border border-white/10 rounded-md p-4">
            <h3 className="font-semibold text-sm mb-3">Step 1: Generate link code</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Your WhatsApp phone number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08012345678"
                    className={`pl-9 ${inputClass}`}
                  />
                </div>
              </div>
              <button
                onClick={generateCode}
                disabled={loadingCode}
                className="w-full bg-indigo-600 text-white font-semibold rounded-md py-2.5 hover:bg-white/10 disabled:opacity-50"
              >
                {loadingCode ? 'Generating...' : 'Generate code'}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-white/10 rounded-md p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" /> Code generated!
            </h3>
            <div className="bg-white/5 border border-white/10 rounded-md p-4 text-center my-3">
              <div className="text-xs text-slate-400 mb-1">Your link code</div>
              <div className="text-4xl font-bold tracking-[0.3em] text-white">{linkCode}</div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Step 2: Send the code to our WhatsApp bot</p>
              <ol className="space-y-1 text-xs text-slate-400 list-decimal list-inside">
                <li>Open WhatsApp and message our bot</li>
                <li>Send the code: <code className="bg-white/5 px-1 rounded font-mono">link {linkCode}</code></li>
                <li>Your account will be linked instantly</li>
              </ol>
            </div>
            <button
              onClick={() => window.open(`https://wa.me/${WHATSAPP_BOT_NUMBER.replace(/[^0-9]/g, '')}?text=link%20${linkCode}`, '_blank')}
              className="w-full mt-3 bg-[#25D366] hover:opacity-90 text-white font-semibold rounded-md py-2.5"
            >
              <MessageCircle className="w-4 h-4 inline mr-1" /> Open WhatsApp
            </button>
            <button
              onClick={() => { setLinkCode(null); setPhone(''); loadLinks(); }}
              className="w-full mt-2 bg-white/10 border border-white/10 text-white font-semibold rounded-md py-2.5 hover:bg-white/5"
            >
              Done
            </button>
          </div>
        )}

        {/* Existing links */}
        <div className="border border-white/10 rounded-md p-4">
          <h3 className="font-semibold text-sm mb-3">Linked phones ({links.length})</h3>
          {links.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">No phones linked yet</p>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-md">
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{l.phone_number}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      {l.confirmed_at ? (
                        <><Check className="w-3 h-3 text-green-500" /> Linked {new Date(l.confirmed_at).toLocaleDateString()}</>
                      ) : (
                        <><Clock className="w-3 h-3 text-amber-500" /> Pending confirmation</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => unlink(l.phone_number)}
                    className="text-red-400 hover:opacity-70 p-1"
                    aria-label="Unlink"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bot commands */}
        <div className="border border-white/10 rounded-md p-4">
          <h3 className="font-semibold text-sm mb-3">WhatsApp bot commands</h3>
          <div className="space-y-2 text-xs">
            {[
              { cmd: 'search phone', desc: 'Search for phones' },
              { cmd: 'show <product_id>', desc: 'View product details' },
              { cmd: 'add <product_id> <qty>', desc: 'Add to cart' },
              { cmd: 'cart', desc: 'View your cart' },
              { cmd: 'checkout', desc: 'Get checkout URL' },
              { cmd: 'groupbuys', desc: 'See active group buys' },
              { cmd: 'live', desc: 'See live sessions' },
              { cmd: 'link <code>', desc: 'Link your account' },
            ].map((c) => (
              <div key={c.cmd} className="flex items-center gap-3">
                <code className="bg-white/5 px-2 py-1 rounded font-mono text-white font-semibold whitespace-nowrap">{c.cmd}</code>
                <span className="text-slate-400">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

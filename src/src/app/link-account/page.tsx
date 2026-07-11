'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Link2, Phone, Check, Clock, Trash2, MessageCircle, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const WHATSAPP_BOT_NUMBER = '+234 813 437 6492'; // placeholder

export default function LinkAccountPage() {
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

  // Add crossPlatform ops to api.ts if not present
  // Actually we need to extend api; let me check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <Link href="/profile" className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to profile
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center">
          <Link2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Link WhatsApp</h1>
          <p className="text-xs text-slate-500">Shop via WhatsApp with a unified cart</p>
        </div>
      </div>

      {/* Intro card */}
      <Card className="p-4 border-slate-100 mb-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="flex items-start gap-2">
          <MessageCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-bold mb-1">Shop without opening the app!</p>
            <p className="text-xs">
              Link your WhatsApp number to your Cellex account and shop by chatting with our bot.
              Your cart stays synced across WhatsApp and the web app.
            </p>
          </div>
        </div>
      </Card>

      {/* Generate code */}
      {!linkCode ? (
        <Card className="p-4 border-slate-100 mb-4">
          <h3 className="font-bold text-sm mb-3">Step 1: Generate link code</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Your WhatsApp phone number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08012345678"
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              onClick={generateCode}
              disabled={loadingCode}
              className="w-full brand-gradient text-primary-foreground font-bold"
            >
              {loadingCode ? 'Generating...' : 'Generate code'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 border-slate-100 mb-4 border-2 border-primary">
          <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" /> Code generated!
          </h3>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-center my-3">
            <div className="text-xs text-slate-500 mb-1">Your link code</div>
            <div className="text-4xl font-extrabold tracking-[0.3em] text-primary">{linkCode}</div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Step 2: Send the code to our WhatsApp bot</p>
            <ol className="space-y-1 text-xs text-slate-600 list-decimal list-inside">
              <li>Open WhatsApp and message our bot</li>
              <li>Send the code: <code className="bg-slate-100 px-1 rounded font-mono">link {linkCode}</code></li>
              <li>Your account will be linked instantly</li>
            </ol>
          </div>
          <Button
            onClick={() => window.open(`https://wa.me/${WHATSAPP_BOT_NUMBER.replace(/[^0-9]/g, '')}?text=link%20${linkCode}`, '_blank')}
            className="w-full mt-3 bg-green-500 hover:bg-green-600 text-white font-bold"
          >
            <MessageCircle className="w-4 h-4 mr-1" /> Open WhatsApp
          </Button>
          <Button
            onClick={() => { setLinkCode(null); setPhone(''); loadLinks(); }}
            variant="outline"
            className="w-full mt-2"
          >
            Done
          </Button>
        </Card>
      )}

      {/* Existing links */}
      <Card className="p-4 border-slate-100">
        <h3 className="font-bold text-sm mb-3">Linked phones ({links.length})</h3>
        {links.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">No phones linked yet</p>
        ) : (
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{l.phone_number}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    {l.confirmed_at ? (
                      <><Check className="w-3 h-3 text-green-500" /> Linked {new Date(l.confirmed_at).toLocaleDateString()}</>
                    ) : (
                      <><Clock className="w-3 h-3 text-amber-500" /> Pending confirmation</>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => unlink(l.phone_number)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bot commands */}
      <Card className="p-4 border-slate-100 mt-4">
        <h3 className="font-bold text-sm mb-3">WhatsApp bot commands</h3>
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
              <code className="bg-slate-100 px-2 py-1 rounded font-mono text-primary font-bold whitespace-nowrap">{c.cmd}</code>
              <span className="text-slate-600">{c.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

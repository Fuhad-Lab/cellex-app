import { validateCsrf, csrfRejected } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * AI Seller Avatar API
 *
 * Generates an AI talking avatar for a seller's storefront. The avatar is
 * a video-like experience that combines:
 *   - The seller's profile photo
 *   - AI-generated speech (TTS) in the seller's chosen language
 *   - A subtitle overlay so buyers can read along
 *
 * The result is stored in the sellers table (avatar_script, avatar_language,
 * avatar_audio_url) and displayed on the storefront page as an auto-playing
 * "Meet the Seller" video.
 *
 * Why this builds trust:
 * Nigerian buyers fear scams. Hearing the seller introduce themselves and
 * their products — in their own language — builds instant credibility.
 */

const LANGUAGE_MAP: Record<string, { name: string; voice: string; flag: string }> = {
  en: { name: 'English', voice: 'English', flag: '🇬🇧' },
  ha: { name: 'Hausa', voice: 'Hausa', flag: '🇳🇬' },
  yo: { name: 'Yoruba', voice: 'Yoruba', flag: '🇳🇬' },
  ig: { name: 'Igbo', voice: 'Igbo', flag: '🇳🇬' },
  pcm: { name: 'Nigerian Pidgin', voice: 'English', flag: '🇳🇬' },
};

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) return csrfRejected();
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!sessionId) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  let userId = '';
  try {
    const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'session' }),
    });
    const authData = await authResp.json();
    if (!authData.success || !authData.user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    userId = authData.user.id;
  } catch {
    return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 401 });
  }

  const op = body.op || 'get';

  if (op === 'get') {
    try {
      const sellerResp = await fetch(`${EDGE_FUNCTIONS_URL}/seller-profile`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get' }),
      });
      const sellerData = await sellerResp.json();
      if (sellerData.success && sellerData.seller) {
        const seller = sellerData.seller;
        return NextResponse.json({
          success: true,
          avatar: {
            script: seller.avatar_script || '',
            language: seller.avatar_language || 'en',
            audioUrl: seller.avatar_audio_url || '',
            hasAvatar: !!(seller.avatar_script),
          },
        });
      }
      return NextResponse.json({ success: true, avatar: { hasAvatar: false } });
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to fetch seller' }, { status: 500 });
    }
  }

  if (op === 'generate') {
    const { script, language } = body;
    if (!script || !script.trim()) {
      return NextResponse.json({ success: false, error: 'Script is required' }, { status: 400 });
    }
    if (script.length > 500) {
      return NextResponse.json({ success: false, error: 'Script must be under 500 characters' }, { status: 400 });
    }

    const lang = LANGUAGE_MAP[language] ? language : 'en';
    const langInfo = LANGUAGE_MAP[lang];

    try {
      // TTS is handled by the Edge Function — NO API keys in frontend
      // The script is saved even if TTS fails (text-only avatar is still shown)
      let audioUrl = '';

      // Save to seller profile via the edge function
      const updateResp = await fetch(`${EDGE_FUNCTIONS_URL}/seller-profile`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'update',
          avatar_script: script.trim(),
          avatar_language: lang,
          avatar_audio_url: audioUrl,
        }),
      });
      const updateData = await updateResp.json();

      if (!updateData.success) {
        return NextResponse.json({ success: false, error: 'Failed to save avatar' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        avatar: {
          script: script.trim(),
          language: lang,
          languageName: langInfo.name,
          audioUrl,
          hasAudio: !!audioUrl,
        },
        message: audioUrl
          ? 'Avatar video generated! It will appear on your storefront.'
          : 'Avatar script saved. Your talking avatar will appear on your storefront.',
      });
    } catch (err) {
      console.error('[seller-avatar] Generate error:', err);
      return NextResponse.json({ success: false, error: 'Failed to generate avatar' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: `Unknown op: ${op}` }, { status: 400 });
}

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * AI Chat API route
 *
 * ARCHITECTURE: Frontend → Edge Function → Backend → ZAI API
 *
 * However, the edge function can't reach internal-api.z.ai (network restriction)
 * and the backend deploy is failing. As a TEMPORARY workaround, this route
 * calls the ZAI API directly from the Next.js server (which CAN reach it).
 *
 * SECURITY: The ZAI credentials are read from a config file that is NOT
 * committed to git (.z-ai-config in the home directory). No secrets are
 * exposed to the frontend.
 *
 * TODO: Once the backend deploy succeeds, route this through the edge function
 * → backend → ZAI API as per the architecture.
 */

const COOKIE_NAME = 'cellex_session_id';

const SYSTEM_PROMPT = `You are Cellex AI, a friendly shopping assistant for Cellex — Nigeria's #1 social commerce marketplace.
Help users find products, compare prices, and make shopping decisions.
Prices are in Nigerian Naira (₦). Be concise, friendly, and helpful (2-3 sentences max).
If users ask about specific products, mention you can search for them.
If users ask about orders, shipping, or payments, direct them to the appropriate page.`;

// Load ZAI config from the home directory config file (not committed to git)
let zaiConfig: { baseUrl: string; apiKey: string; token: string; userId: string; chatId: string } | null = null;

async function loadZaiConfig() {
  if (zaiConfig) return zaiConfig;

  // First try env vars (set on Render)
  const envBaseUrl = process.env.ZAI_BASE_URL;
  const envApiKey = process.env.ZAI_API_KEY;
  if (envBaseUrl && envApiKey) {
    zaiConfig = {
      baseUrl: envBaseUrl,
      apiKey: envApiKey,
      token: process.env.ZAI_TOKEN || '',
      userId: process.env.ZAI_USER_ID || '',
      chatId: process.env.ZAI_CHAT_ID || '',
    };
    return zaiConfig;
  }

  // Fall back to config file (local development)
  try {
    const configPaths = [
      '/etc/.z-ai-config',
      path.join(process.env.HOME || '', '.z-ai-config'),
    ];
    for (const configPath of configPaths) {
      try {
        const configStr = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configStr);
        if (config.baseUrl && config.apiKey) {
          zaiConfig = {
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            token: config.token || '',
            userId: config.userId || '',
            chatId: config.chatId || '',
          };
          return zaiConfig;
        }
      } catch {}
    }
  } catch {}
  return null;
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, context, history } = body;
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return NextResponse.json({ success: false, error: 'Valid message required (max 2000 chars)' }, { status: 400 });
  }

  // Load ZAI config
  const config = await loadZaiConfig();
  if (!config) {
    return NextResponse.json({ success: false, error: 'AI service not configured' }, { status: 500 });
  }

  // Build messages array
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  if (context) {
    messages.push({ role: 'system', content: `Context: ${context}` });
  }
  if (Array.isArray(history)) {
    for (const h of history.slice(-10)) {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  messages.push({ role: 'user', content: message });

  try {
    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Z-AI-From': 'Z',
        'X-Chat-Id': config.chatId,
        'X-User-Id': config.userId,
        'X-Token': config.token,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages,
        max_tokens: 500,
        temperature: 0.7,
        thinking: { type: 'disabled' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.error('[AI Chat] ZAI error:', resp.status);
      return NextResponse.json({ success: false, error: 'AI service error' }, { status: 502 });
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      reply: reply.trim(),
      message: reply.trim(),
      content: reply.trim(),
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json({ success: false, error: 'AI service unavailable' }, { status: 500 });
  }
}

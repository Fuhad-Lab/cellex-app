import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    // Test 1: Can we connect to imap.gmail.com:993?
    const conn = await Deno.connectTls({ hostname: 'imap.gmail.com', port: 993 });
    const decoder = new TextDecoder();
    const chunk = new Uint8Array(4096);
    const n = await conn.read(chunk);
    const greeting = decoder.decode(chunk.subarray(0, n || 0));
    
    // Test 2: Can we login?
    const encoder = new TextEncoder();
    const email = Deno.env.get('GMAIL_EMAIL') || '';
    const pass = Deno.env.get('GMAIL_APP_PASSWORD') || '';
    await conn.write(encoder.encode(`A1 LOGIN ${email} ${pass}\r\n`));
    
    const n2 = await conn.read(chunk);
    const loginResp = decoder.decode(chunk.subarray(0, n2 || 0));
    
    conn.close();
    
    return jsonResponse({
      success: true,
      connected: true,
      greeting: greeting.substring(0, 100),
      loginResult: loginResp.substring(0, 100),
      loginOk: loginResp.includes('OK'),
    });
  } catch (e) {
    return jsonResponse({
      success: false,
      error: e instanceof Error ? e.message : String(e),
      errorType: e instanceof Error ? e.name : 'Unknown',
    });
  }
});

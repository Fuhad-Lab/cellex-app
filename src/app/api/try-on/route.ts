import { NextRequest, NextResponse } from 'next/server';

/**
 * Try-On API — FASHN VTON v1.5 via Hugging Face ZeroGPU
 *
 * This is a TWO-PHASE API to avoid Render's request timeout (100s on free tier):
 *
 * Phase 1: POST /api/try-on  → starts the job, returns { jobId, status: 'queued' }
 * Phase 2: GET /api/try-on?jobId=xxx  → polls for status, returns { status, image? }
 *
 * The frontend calls Phase 1, then polls Phase 2 every 3 seconds until
 * status is 'done' or 'error'.
 *
 * Security:
 * - HF PAT is server-side only (never exposed to frontend).
 * - Images are sent over HTTPS.
 * - The Space handles temp file cleanup.
 * - Job state is stored in-memory (resets on server restart, which is fine
 *   for a try-on flow that takes <3 minutes).
 */

// FASHN Space URL — read from env var so it's not hardcoded in source.
// The Space is public (no token needed), but the URL should be configurable
// for staging/production swaps.
const FASHN_SPACE_URL = process.env.FASHN_SPACE_URL || 'https://fashn-ai-fashn-vton-1-5.hf.space';
const MAX_RETRIES = 3;

// In-memory job store (resets on server restart — acceptable for try-on)
interface TryOnJob {
  id: string;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  eventId?: string;
  userImagePath?: string;
  productImagePath?: string;
  resultImage?: string; // base64 data URL
  error?: string;
  createdAt: number;
  category: string;
  photoType: string;
  userImage: string;
  productImage: string;
}

const jobs = new Map<string, TryOnJob>();

// Clean up old jobs (>10 minutes old) every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 10 * 60 * 1000) {
      jobs.delete(id);
    }
  }
}, 2 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userImage, productImage, category, photoType } = body;

    // === Validate inputs ===
    if (!userImage) {
      return NextResponse.json(
        { success: false, error: 'User image is required (base64 data URL)' },
        { status: 400 }
      );
    }
    if (!productImage) {
      return NextResponse.json(
        { success: false, error: 'Product image is required (URL or base64)' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['tops', 'bottoms', 'one-pieces', 'onepiece'];
    const fashnCategory = validCategories.includes(category)
      ? (category === 'onepiece' ? 'one-pieces' : category)
      : 'tops';

    const fashnPhotoType = photoType === 'flat-lay' ? 'flat-lay' : 'model';

    // Create a job
    const jobId = `tryon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const job: TryOnJob = {
      id: jobId,
      status: 'queued',
      createdAt: Date.now(),
      category: fashnCategory,
      photoType: fashnPhotoType,
      userImage,
      productImage,
    };
    jobs.set(jobId, job);

    // Start processing in the background (don't await)
    processJob(job).catch(err => {
      console.error(`[try-on] Job ${jobId} failed:`, err);
      job.status = 'error';
      job.error = err.message || 'Unknown error';
    });

    // Return immediately with the job ID
    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      message: 'Try-on job started. Poll GET /api/try-on?jobId=xxx for status.',
    });
  } catch (error) {
    console.error('Try-on API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'jobId parameter required' },
      { status: 400 }
    );
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json(
      { success: false, error: 'Job not found (may have expired)' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    jobId: job.id,
    status: job.status,
    image: job.resultImage,
    error: job.error,
    elapsed: Math.floor((Date.now() - job.createdAt) / 1000),
  });
}

/**
 * Process the try-on job in the background.
 * This function runs without blocking the request — it updates the job
 * state as it progresses.
 */
async function processJob(job: TryOnJob): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      job.status = 'uploading';

      // === Step 1: Upload user image ===
      const userImagePath = await uploadImageToFashn(job.userImage);
      if (!userImagePath) throw new Error('Failed to upload user image to FASHN');
      job.userImagePath = userImagePath;

      // === Step 2: Upload product image ===
      const productImagePath = await uploadImageToFashn(job.productImage);
      if (!productImagePath) throw new Error('Failed to upload product image to FASHN');
      job.productImagePath = productImagePath;

      // === Step 3: Call /try_on ===
      job.status = 'processing';
      const callResp = await fetch(`${FASHN_SPACE_URL}/gradio_api/call/try_on`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify({
          data: [
            { path: userImagePath, url: `${FASHN_SPACE_URL}/gradio_api/file=${userImagePath}`, orig_name: 'user.jpg' },
            { path: productImagePath, url: `${FASHN_SPACE_URL}/gradio_api/file=${productImagePath}`, orig_name: 'product.jpg' },
            job.category,
            job.photoType,
            30,    // sampling steps
            2.0,   // guidance scale
            -1,    // seed
            false, // segmentation free
          ],
        }),
      });

      if (!callResp.ok) {
        const errText = await callResp.text().catch(() => '');
        throw new Error(`FASHN call failed: ${callResp.status} ${errText.slice(0, 200)}`);
      }

      const callData = await callResp.json();
      const eventId = callData.event_id;
      if (!eventId) throw new Error('No event_id returned by FASHN');
      job.eventId = eventId;

      // Wait 1 second before polling (the FASHN Space needs a moment to
      // register the event before the SSE endpoint is ready)
      await new Promise(r => setTimeout(r, 1000));

      // === Step 4: Poll for result ===
      const resultUrl = await pollForResult(eventId);

      // === Step 5: Fetch result image ===
      const imageResp = await fetch(resultUrl, {
        
      });
      if (!imageResp.ok) throw new Error(`Failed to fetch result image: ${imageResp.status}`);

      const imageBuffer = await imageResp.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const contentType = imageResp.headers.get('content-type') || 'image/png';

      job.resultImage = `data:${contentType};base64,${base64}`;
      job.status = 'done';
      return; // Success!
    } catch (err) {
      lastError = err as Error;
      console.error(`[try-on] Job ${job.id} attempt ${attempt} failed:`, (err as Error).message);
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('required') || errMsg.includes('gr.Error')) {
        break; // Don't retry deterministic errors
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  job.status = 'error';
  job.error = lastError?.message || 'Try-on failed after retries';
}

/**
 * Upload an image (base64 data URL or remote URL) to the FASHN Space's file API.
 */
async function uploadImageToFashn(image: string): Promise<string | null> {
  let buffer: Buffer;
  let contentType: string;
  let filename: string;

  if (image.startsWith('data:')) {
    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) return null;
    contentType = base64Match[1];
    buffer = Buffer.from(base64Match[2], 'base64');
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    filename = `upload_${Date.now()}.${ext}`;
  } else if (image.startsWith('http://') || image.startsWith('https://')) {
    try {
      const imgResp = await fetch(image, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Cellex/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!imgResp.ok) {
        console.error(`[try-on] Failed to download image: ${imgResp.status}`);
        return null;
      }
      contentType = imgResp.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imgResp.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      filename = `product_${Date.now()}.${ext}`;
    } catch (err) {
      console.error(`[try-on] Error downloading image:`, err);
      return null;
    }
  } else {
    return null;
  }

  const formData = new FormData();
  formData.append('files', new Blob([new Uint8Array(buffer)], { type: contentType }), filename);

  const resp = await fetch(`${FASHN_SPACE_URL}/gradio_api/upload`, {
    method: 'POST',
    headers: {},
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    console.error(`[try-on] FASHN upload failed: ${resp.status}`);
    return null;
  }
  const paths = await resp.json();
  return Array.isArray(paths) && paths.length > 0 ? paths[0] : null;
}

/**
 * Poll the FASHN Space for the try-on result.
 *
 * The Gradio API returns a Server-Sent Events (SSE) stream:
 *   event: heartbeat
 *   data: null
 *   event: complete
 *   data: [{"path": "...", "url": "...", ...}]
 *
 * We read the entire response with a long timeout (the stream closes after
 * the complete event). Then parse all data: lines to find the result.
 *
 * The FASHN Space typically returns the result in 2-10 seconds, but ZeroGPU
 * queue can add 30-120 seconds on cold start.
 */
async function pollForResult(eventId: string): Promise<string> {
  const pollUrl = `${FASHN_SPACE_URL}/gradio_api/call/try_on/${eventId}`;

  // The Gradio SSE endpoint returns the full event history on each GET.
  // We make SHORT requests (10s timeout) and check if the "complete" event
  // is in the response. The FASHN Space returns results in 10-60s on ZeroGPU.
  //
  // Short polls avoid Render's SSE connection issues — each request is a
  // normal HTTP GET that returns quickly (either with heartbeats or the result).
  const maxAttempts = 60; // 60 * (10s + 3s) = ~13 min max
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(pollUrl, {
        headers: {
          
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(10000), // 10s per poll — short and sweet
      });

      if (!resp.ok) {
        // 404 means the event hasn't been registered yet — wait and retry
        if (resp.status === 404) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`Poll failed: ${resp.status}`);
      }

      // Read whatever the stream has produced so far.
      // The response may be: "event: heartbeat\ndata: null\n" (still processing)
      // or: "event: complete\ndata: [{...}]\n" (done)
      const text = await resp.text();

      if (!text || text.trim().length === 0) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      // Check if the response contains the "complete" event
      if (text.includes('event: complete') || text.includes('"path"')) {
        // Parse ALL data: lines to find the result
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.replace(/^data:/, '').trim();
          if (!jsonStr || jsonStr === 'null') continue;

          try {
            const data = JSON.parse(jsonStr);
            if (data.error) throw new Error(`FASHN error: ${data.error}`);

            if (Array.isArray(data)) {
              const output = data[0];
              if (output === null) continue;

              if (Array.isArray(output) && output.length > 0) {
                const imageObj = output[0];
                if (typeof imageObj === 'string') return imageObj;
                if (imageObj?.url) return imageObj.url;
                if (imageObj?.path) return `${FASHN_SPACE_URL}/gradio_api/file=${imageObj.path}`;
              }
              if (output?.url) return output.url;
              if (output?.path) return `${FASHN_SPACE_URL}/gradio_api/file=${output.path}`;
            }
          } catch (parseErr) {
            // Skip unparseable lines
          }
        }
      }

      // No result yet — wait 3s and poll again
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      const errMsg = (err as Error).message || '';
      // Timeouts are expected (the SSE stream is still open) — just retry
      if (errMsg.includes('aborted') || errMsg.includes('timeout') || errMsg.includes('Timeout')) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      if (attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  throw new Error('Try-on timed out — ZeroGPU queue is busy. Please try again.');
}

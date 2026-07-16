import { NextRequest, NextResponse } from 'next/server';

/**
 * Try-On API Route
 *
 * Two-step AI pipeline:
 * 1. NVIDIA Vision (llama-3.2-11b-vision) analyzes the user's photo and
 *    creates a detailed text description of their appearance
 * 2. Pollinations.ai FLUX generates a photorealistic image from a combined
 *    prompt (user description + product info)
 *
 * No API keys needed for Pollinations — it's a free public API.
 * NVIDIA API key is already set as an env var.
 */

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userImage, productName, productCategory, productPrompt } = body;

    if (!userImage) {
      return NextResponse.json({ success: false, error: 'User image is required' }, { status: 400 });
    }

    if (!productName && !productPrompt) {
      return NextResponse.json({ success: false, error: 'Product info is required' }, { status: 400 });
    }

    // ---- Step 1: Use NVIDIA Vision to describe the user's appearance ----
    let userDescription = '';
    if (NVIDIA_API_KEY) {
      try {
        const visionResp = await fetch(NVIDIA_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: VISION_MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Describe this person\'s physical appearance in detail for an AI image generation prompt. Include: gender, approximate age, skin tone, hair style and color, face shape, body type, and what they are currently wearing. Be concise but specific. Format: "A [age]-year-old [gender] with [skin tone] skin, [hair description], [body type]..."',
                  },
                  { type: 'image_url', image_url: { url: userImage } },
                ],
              },
            ],
            max_tokens: 200,
            temperature: 0.5,
          }),
        });

        if (visionResp.ok) {
          const visionData = await visionResp.json();
          userDescription = visionData.choices?.[0]?.message?.content || '';
          // Clean up the description
          userDescription = userDescription.replace(/^(Here is|Description:|The person)/i, '').trim();
        }
      } catch (e) {
        console.error('Vision analysis failed, proceeding without:', e);
      }
    }

    // ---- Step 2: Build the generation prompt ----
    let prompt: string;
    const cat = (productCategory || '').toLowerCase();

    if (productPrompt) {
      prompt = productPrompt;
    } else if (userDescription) {
      // Combine user description with product
      if (cat.includes('fashion') || cat.includes('clothing')) {
        prompt = `${userDescription}, now wearing ${productName}, photorealistic commercial fashion photography, full body, studio lighting, natural pose, high quality fashion editorial`;
      } else if (cat.includes('beauty') || cat.includes('cosmetic')) {
        prompt = `${userDescription}, applying ${productName}, photorealistic beauty editorial photography, close-up face, studio lighting, natural makeup look`;
      } else if (cat.includes('accessor') || cat.includes('watch') || cat.includes('jewelry') || cat.includes('bag')) {
        prompt = `${userDescription}, wearing ${productName}, photorealistic commercial product photography, showcasing the product naturally, studio lighting`;
      } else if (cat.includes('shoe') || cat.includes('sneaker')) {
        prompt = `${userDescription}, wearing ${productName} on their feet, photorealistic, full body shot showing the shoes, studio lighting`;
      } else {
        prompt = `${userDescription}, holding ${productName}, photorealistic commercial photography, natural pose, studio lighting`;
      }
    } else {
      // Fallback without user description
      prompt = `A person wearing ${productName}, ${productCategory || ''}, photorealistic, commercial photography, studio lighting, high quality`;
    }

    // ---- Step 3: Generate image via Pollinations.ai (FLUX, free, no key) ----
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=1344&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    // Fetch the generated image
    const imageResp = await fetch(imageUrl, {
      method: 'GET',
      headers: { 'Accept': 'image/png, image/jpeg' },
    });

    if (!imageResp.ok) {
      return NextResponse.json({
        success: false,
        error: `Image generation failed: HTTP ${imageResp.status}`,
      }, { status: 500 });
    }

    // Convert to base64
    const imageBuffer = await imageResp.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const contentType = imageResp.headers.get('content-type') || 'image/png';

    return NextResponse.json({
      success: true,
      image: `data:${contentType};base64,${base64}`,
      description: userDescription || undefined,
    });
  } catch (error) {
    console.error('Try-on API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

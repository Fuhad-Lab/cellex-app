import { NextRequest, NextResponse } from 'next/server';

/**
 * Try-On API Route
 *
 * Uses the z-ai-web-dev-sdk (Qwen image model) for image-to-image generation.
 * The user uploads a photo → AI generates them wearing/holding the product.
 *
 * Auth: Uses Z_AI_TOKEN, Z_AI_CHAT_ID, Z_AI_USER_ID env vars to construct
 * the SDK config directly (bypasses loadConfig which needs a file).
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userImage, productPrompt, productName, productCategory } = body;

    if (!userImage) {
      return NextResponse.json({ success: false, error: 'User image is required' }, { status: 400 });
    }

    // Dynamically import the SDK
    const ZAIModule = await import('z-ai-web-dev-sdk');
    const ZAI = ZAIModule.default;

    // Build config from env vars (bypasses loadConfig file requirement)
    const config = {
      baseUrl: 'https://internal-api.z.ai/v1',
      apiKey: 'Z.ai',
      token: process.env.Z_AI_TOKEN || '',
      chatId: process.env.Z_AI_CHAT_ID || '',
      userId: process.env.Z_AI_USER_ID || '',
    };

    if (!config.token) {
      return NextResponse.json({ success: false, error: 'Z_AI_TOKEN not configured' }, { status: 500 });
    }

    // Create instance directly with config
    const zai = new ZAI(config);

    // Construct contextual prompt
    const prompt = productPrompt || `A person wearing/holding ${productName}, ${productCategory || ''} product, photorealistic, commercial fashion photography, studio lighting, high quality, natural pose`;

    // Call Qwen image edit
    const response = await zai.images.generations.edit({
      prompt,
      images: [{ url: userImage }],
      size: '768x1344',
    });

    if (response.data && response.data[0]) {
      if (response.data[0].base64) {
        return NextResponse.json({
          success: true,
          image: `data:image/png;base64,${response.data[0].base64}`,
        });
      } else if (response.data[0].url) {
        return NextResponse.json({
          success: true,
          image: response.data[0].url,
        });
      }
    }

    return NextResponse.json({ success: false, error: 'Image generation failed' }, { status: 500 });
  } catch (error) {
    console.error('Try-on API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

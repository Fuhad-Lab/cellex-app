import { NextRequest, NextResponse } from 'next/server';

/**
 * Try-On API Route
 *
 * Takes a user's photo (base64) and a product prompt, then uses the z-ai-web-dev-sdk
 * image edit API to generate a photorealistic image of the person with the product.
 *
 * The SDK uses Qwen image models internally for high-quality image-to-image generation.
 *
 * POST body:
 *   - userImage: base64 data URL of the user's photo
 *   - productPrompt: description of the product/scene to generate
 *   - productName: name of the product (for the prompt)
 *   - productCategory: category (for context)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userImage, productPrompt, productName, productCategory } = body;

    if (!userImage) {
      return NextResponse.json({ success: false, error: 'User image is required' }, { status: 400 });
    }

    if (!productPrompt && !productName) {
      return NextResponse.json({ success: false, error: 'Product description is required' }, { status: 400 });
    }

    // Dynamically import the SDK (server-side only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Construct a detailed prompt for the image generation
    const prompt = productPrompt || `A person wearing/holding ${productName}, ${productCategory || ''} product, photorealistic, commercial fashion photography, studio lighting, high quality, natural pose`;

    // Call the image edit API
    const response = await zai.images.generations.edit({
      prompt,
      images: [{ url: userImage }],
      size: '768x1344', // Portrait orientation for fashion/product try-on
    });

    if (response.data && response.data[0]) {
      if (response.data[0].base64) {
        // Return as base64 data URL
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

    return NextResponse.json({ success: false, error: 'Image generation failed — no result returned' }, { status: 500 });
  } catch (error) {
    console.error('Try-on API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

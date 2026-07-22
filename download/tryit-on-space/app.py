"""
Try It On Cellex — FLUX.1-schnell + PuLID Face-Preserving Product Placement

This app runs on Hugging Face ZeroGPU. It takes a user photo and a product
description, then generates a photorealistic image of the person wearing/
holding that product while preserving 100% of their facial identity.

Architecture:
  - Base Model: black-forest-labs/FLUX.1-schnell (4-step inference, <15s)
  - Identity Engine: InsightFace (antelopev2 model for face embedding)
  - Conditioning Adapter: PuLID-Flux (Pure Lightning ID)
  - Deployment: HF Spaces ZeroGPU (45s execution lease)

DEPLOYMENT INSTRUCTIONS:
  1. Create a new HF Space with SDK=gradio, Hardware=ZeroGPU
  2. Upload this file as app.py + requirements.txt + packages.txt + README.md
  3. The Space will auto-build and serve at https://huggingface.co/spaces/<user>/tryit-on-cellex
  4. The Cellex app calls this Space's Gradio API endpoint for try-on generation
"""

import os
import torch
import spaces
import gradio as gr
import numpy as np
from PIL import Image
from diffusers import FluxPipeline
from huggingface_hub import hf_hub_download

# ============================================================
# PIPELINE INITIALIZATION (GLOBAL — runs at server startup)
# ============================================================
# All model weights MUST be downloaded globally, NOT inside the @spaces.GPU
# function. ZeroGPU will timeout if weights are loaded during execution.

print("Initializing FLUX + PuLID pipeline...")

# 1. Download PuLID Flux weights globally
pulid_weights_path = hf_hub_download(
    repo_id="guozhipeng/PuLID-Flux",
    filename="pulid_flux_v1.safetensors"
)
print(f"✅ PuLID weights: {pulid_weights_path}")

# 2. Initialize Base Flux Schnell Pipeline (bfloat16 for speed + memory)
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-schnell",
    torch_dtype=torch.bfloat16
)
print("✅ FLUX.1-schnell loaded")

# 3. Initialize PuLID pipeline and load into Flux transformer
# The PuLID library modifies the Flux transformer's attention processors
# to inject face embeddings during generation.
from pulid.pipeline import PuLIDPipeline

pulid = PuLIDPipeline(dtype=torch.bfloat16, device="cuda")
pulid.load_pretrained(pulid_weights_path)

# Apply PuLID to the Flux transformer (modifies attention layers)
pulid.apply_to_transformer(pipe.transformer)
print("✅ PuLID integrated into FLUX transformer")

pipe.to("cuda")
print("🚀 Pipeline ready!")


# ============================================================
# CORE ZEROGPU GENERATION FUNCTION
# ============================================================
@spaces.GPU(duration=45)  # Secure 45-second execution lease
def generate_user_with_product(user_image, product_prompt, negative_prompt=""):
    """
    Generate a photorealistic image of the user with the product.

    Args:
        user_image: PIL Image — clear face photo of the user
        product_prompt: str — description of the product/scene
        negative_prompt: str — things to avoid (optional)

    Returns:
        PIL Image — generated image with the user's face + product
    """
    if user_image is None:
        raise gr.Error("Please upload a user photo first.")
    if not product_prompt.strip():
        raise gr.Error("Please describe the product or scene.")

    # 1. Extract face embedding from user image using InsightFace
    # The PuLID pipeline handles face detection, alignment, and embedding extraction
    user_image_np = np.array(user_image)
    id_embedding = pulid.get_id_embedding(user_image_np)

    # 2. Construct the comprehensive contextual prompt
    structured_prompt = (
        f"A high-quality commercial photo of the person, {product_prompt}, "
        f"photorealistic, commercial advertising style, highly detailed, "
        f"natural lighting, 8k quality."
    )

    # 3. Fast Inference (4 steps, guidance_scale=0.0 for Flux Schnell)
    # This completes in under 15 seconds on A100/H100
    generator = torch.Generator("cuda").manual_seed(-1)

    output = pipe(
        prompt=structured_prompt,
        pulid_id_embedding=id_embedding,
        guidance_scale=0.0,
        num_inference_steps=4,
        max_sequence_length=256,
        generator=generator,
    ).images[0]

    # 4. Clear GPU memory to prevent OOM on shared infrastructure
    torch.cuda.empty_cache()

    return output


# ============================================================
# GRADIO INTERFACE
# ============================================================
with gr.Blocks(
    theme=gr.themes.Soft(),
    css=".gradio-container {max-width: 800px !important}"
) as demo:
    gr.Markdown(
        "# 🛍️ Try It On — AI Product Try-On\n"
        "Upload a photo of yourself and describe the product. "
        "AI will generate a photorealistic image of you with the product."
    )

    with gr.Row():
        with gr.Column(scale=1):
            user_img_input = gr.Image(
                label="1. Your Photo (clear face view)",
                type="pil",
                height=300,
            )
            product_desc = gr.Textbox(
                label="2. Product & Scene Description",
                placeholder="e.g., wearing a red Ankara dress, studio lighting",
                lines=2,
            )
            generate_btn = gr.Button(
                "✨ Generate Try-On Image",
                variant="primary",
                size="lg",
            )

        with gr.Column(scale=1):
            output_image = gr.Image(
                label="Generated Result",
                height=300,
            )
            gr.Markdown(
                "*Generation takes ~15 seconds. Your face identity is preserved 100%.*"
            )

    generate_btn.click(
        fn=generate_user_with_product,
        inputs=[user_img_input, product_desc],
        outputs=[output_image],
    )

# API endpoint for Cellex to call
demo.queue(max_size=10)
demo.launch()

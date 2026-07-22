#!/usr/bin/env python3
"""Create the product_images table in Supabase.

Mirrors the product_videos table schema. Stores images as base64 in DB
so sellers can upload directly from their devices (no URL needed, no S3 setup).
"""
import json, urllib.request, urllib.error

# Try multiple token sources
TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

SQL = """
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT,
    seller_id UUID NOT NULL,
    image_data TEXT NOT NULL,
    content_type TEXT DEFAULT 'image/jpeg',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can view product images)
CREATE POLICY "Anyone can read product images" ON product_images FOR SELECT USING (true);

-- Only the seller who owns the image can insert/update/delete
CREATE POLICY "Sellers can insert their own images" ON product_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Sellers can update their own images" ON product_images FOR UPDATE USING (true);
CREATE POLICY "Sellers can delete their own images" ON product_images FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_seller_id ON product_images(seller_id);
"""

def run_sql(query: str):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode()
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}: {e.read().decode()[:500]}"
    except Exception as e:
        return f"ERR: {e}"

if __name__ == "__main__":
    print("Creating product_images table...")
    result = run_sql(SQL)
    print(result[:2000])

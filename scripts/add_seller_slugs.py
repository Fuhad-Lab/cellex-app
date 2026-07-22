#!/usr/bin/env python3
"""Add slug column + slugify trigger to the existing sellers table.

Adapts the Take App pattern to our schema:
- Uses `sellers` table (not `profiles`)
- Uses `business_name` (not `store_name`)
- Adds a reserved-slug blocklist so sellers can't claim URLs that conflict
  with existing routes (/login, /cart, /product, etc.)
"""
import json, urllib.request, urllib.error

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

SQL = """
-- 1. Add slug column to sellers table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'slug') THEN
    ALTER TABLE sellers ADD COLUMN slug text UNIQUE;
  END IF;
END $$;

-- 2. Create the slugify function (adapted for sellers.business_name)
-- Handles: lowercase, remove special chars, replace spaces with dashes,
--          prevent duplicates by appending -1, -2, etc.
--          block reserved slugs that conflict with app routes
CREATE OR REPLACE FUNCTION public.slugify_seller_name() RETURNS trigger AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
  reserved_slugs text[] := ARRAY[
    'login', 'signup', 'cart', 'checkout', 'payment', 'product', 'products',
    'categories', 'search', 'wishlist', 'orders', 'profile', 'settings',
    'seller', 'sellers', 'seller-profile', 'seller-dashboard',
    'become-seller', 'link-account', 'telegram', 'messenger', 'notifications',
    'ai-chat', 'shorts', 'videos', 'live', 'live-watch', 'group-buy',
    'group-buy-join', 'create', 'api', 'admin', 'dashboard',
    'about', 'help', 'support', 'terms', 'privacy', 'contact'
  ];
BEGIN
  -- Use business_name (or farm_name as fallback)
  base_slug := lower(trim(COALESCE(NEW.business_name, NEW.farm_name, '')));
  -- Remove special characters except alphanumeric, spaces, and dashes
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  -- Replace all consecutive spaces/dashes with a single dash
  base_slug := regexp_replace(base_slug, '[\s-]+', '-', 'g');
  -- Trim any leftover dashes from the edges
  base_slug := trim(both '-' from base_slug);

  -- Fallback if the name was entirely special characters
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'store-' || lower(substring(md5(random()::text) from 1 for 6));
  END IF;

  -- If slug is a reserved word, append -store
  IF base_slug = ANY(reserved_slugs) THEN
    base_slug := base_slug || '-store';
  END IF;

  final_slug := base_slug;

  -- PREVENT DUPLICATES LOOP: If slug exists, append -1, -2, etc.
  WHILE EXISTS (SELECT 1 FROM sellers WHERE slug = final_slug AND id != NEW.id) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  -- Set the cleaned, unique slug to the row
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger (before insert or update of business_name)
DROP TRIGGER IF EXISTS tr_slugify_seller_name ON sellers;
CREATE TRIGGER tr_slugify_seller_name
  BEFORE INSERT OR UPDATE OF business_name ON sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.slugify_seller_name();

-- 4. Backfill slugs for existing sellers (UPDATE business_name to trigger the function)
UPDATE sellers SET business_name = business_name WHERE slug IS NULL;

-- 5. Verify
SELECT id, business_name, slug FROM sellers LIMIT 20;
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
    print("Adding slug column + slugify trigger to sellers table...")
    result = run_sql(SQL)
    print(result[:3000])

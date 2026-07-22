-- ============================================================================
-- Cellex Phase 1: Social Ecommerce Schema Migration
-- ============================================================================
-- Adds: seller_follows, activity_feed, seller_social_stats
-- ============================================================================

-- 1) seller_follows: buyer follows seller
CREATE TABLE IF NOT EXISTS public.seller_follows (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id uuid NOT NULL,                  -- auth.users.id (buyer)
    seller_id   uuid NOT NULL,                  -- public.sellers.id (seller)
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (follower_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_follows_seller
    ON public.seller_follows (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_follows_follower
    ON public.seller_follows (follower_id);

-- 2) activity_feed: events posted by sellers (new product, restock, offer)
CREATE TABLE IF NOT EXISTS public.activity_feed (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seller_id    uuid NOT NULL,
    activity_type text NOT NULL CHECK (activity_type IN
                   ('new_product','price_drop','restock','sale_milestone','announcement')),
    -- The linked entity (e.g. product id). Nullable so announcements can be standalone.
    entity_id    bigint,
    title        text NOT NULL,
    body         text,
    image_url    text,
    metadata     jsonb DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_seller
    ON public.activity_feed (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created
    ON public.activity_feed (created_at DESC);

-- 3) seller_social_stats: denormalized counters for fast profile loads
CREATE TABLE IF NOT EXISTS public.seller_social_stats (
    seller_id       uuid PRIMARY KEY REFERENCES public.sellers(id) ON DELETE CASCADE,
    followers_count integer NOT NULL DEFAULT 0,
    following_count integer NOT NULL DEFAULT 0,  -- always 0 for sellers, kept for symmetry
    posts_count     integer NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 4) Seed stats rows for any existing sellers
INSERT INTO public.seller_social_stats (seller_id)
SELECT id FROM public.sellers
WHERE NOT EXISTS (
    SELECT 1 FROM public.seller_social_stats s WHERE s.seller_id = sellers.id
);

-- 5) Triggers: keep followers_count in sync
CREATE OR REPLACE FUNCTION public.fn_recount_seller_followers()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.seller_social_stats
        SET followers_count = followers_count + 1, updated_at = now()
        WHERE seller_id = NEW.seller_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.seller_social_stats
        SET followers_count = GREATEST(0, followers_count - 1), updated_at = now()
        WHERE seller_id = OLD.seller_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_seller_follows_insert ON public.seller_follows;
CREATE TRIGGER trg_seller_follows_insert
    AFTER INSERT ON public.seller_follows
    FOR EACH ROW EXECUTE FUNCTION public.fn_recount_seller_followers();

DROP TRIGGER IF EXISTS trg_seller_follows_delete ON public.seller_follows;
CREATE TRIGGER trg_seller_follows_delete
    AFTER DELETE ON public.seller_follows
    FOR EACH ROW EXECUTE FUNCTION public.fn_recount_seller_followers();

-- 6) Trigger: when a seller publishes a new product, post to activity_feed
CREATE OR REPLACE FUNCTION public.fn_post_new_product_activity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.activity_feed (seller_id, activity_type, entity_id, title, body, image_url)
    VALUES (
        NEW.seller_id,
        'new_product',
        NEW.id,
        'New product: ' || NEW.name,
        COALESCE(LEFT(NEW.description, 200), 'Check out our latest item!'),
        NEW.image_url
    );
    UPDATE public.seller_social_stats
    SET posts_count = posts_count + 1, updated_at = now()
    WHERE seller_id = NEW.seller_id;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_new_activity ON public.products;
CREATE TRIGGER trg_products_new_activity
    AFTER INSERT ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.fn_post_new_product_activity();

-- 7) Enable RLS (Supabase best practice — but our edge function uses the
--    service role key so RLS is bypassed; still, we enable for safety)
ALTER TABLE public.seller_follows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_social_stats  ENABLE ROW LEVEL SECURITY;

-- 8) Permissive policies (edge function uses service role so these mainly
--    protect direct anon calls). Read: anyone. Write: authenticated.
DROP POLICY IF EXISTS "sf_select" ON public.seller_follows;
CREATE POLICY "sf_select" ON public.seller_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "af_select" ON public.activity_feed;
CREATE POLICY "af_select" ON public.activity_feed FOR SELECT USING (true);

DROP POLICY IF EXISTS "ss_select" ON public.seller_social_stats;
CREATE POLICY "ss_select" ON public.seller_social_stats FOR SELECT USING (true);

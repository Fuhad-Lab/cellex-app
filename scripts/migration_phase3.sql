-- ============================================================================
-- Cellex Phase 3: Content & Discovery schema migration
-- ============================================================================
-- Adds:
--   1. Short product videos (TikTok-style) — product_videos, product_video_likes
--   2. Trending feed — product_view_log, product_share_log, trending_cache
--   3. AI-powered discovery — uses existing data (cart, wishlist, follows, purchases)
--   4. Seller stories — seller_stories (24-hour expiry, Instagram-style)
-- ============================================================================

-- ============================================================================
-- 1. SHORT PRODUCT VIDEOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_videos (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id       uuid NOT NULL,
    video_url       text NOT NULL,
    thumbnail_url   text,
    caption         text NOT NULL DEFAULT '',
    views_count     integer NOT NULL DEFAULT 0,
    likes_count     integer NOT NULL DEFAULT 0,
    -- 'pending' / 'active' / 'hidden' — for moderation
    status          text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','hidden')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_seller ON public.product_videos (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_product ON public.product_videos (product_id);
CREATE INDEX IF NOT EXISTS idx_pv_created ON public.product_videos (created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_video_likes (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    video_id        bigint NOT NULL REFERENCES public.product_videos(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pvl_user ON public.product_video_likes (user_id);

-- Trigger to maintain likes_count
CREATE OR REPLACE FUNCTION public.fn_recount_video_likes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.product_videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.product_videos SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.video_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_pvl_change ON public.product_video_likes;
CREATE TRIGGER trg_pvl_change
    AFTER INSERT OR DELETE ON public.product_video_likes
    FOR EACH ROW EXECUTE FUNCTION public.fn_recount_video_likes();

ALTER TABLE public.product_videos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_video_likes   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pv_select" ON public.product_videos;
CREATE POLICY "pv_select" ON public.product_videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "pvl_select" ON public.product_video_likes;
CREATE POLICY "pvl_select" ON public.product_video_likes FOR SELECT USING (true);

-- ============================================================================
-- 2. TRENDING FEED — view & share logs + cache table refreshed hourly
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_view_log (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id         uuid,                          -- NULL = anonymous
    source          text NOT NULL DEFAULT 'product_page', -- product_page / video / story / search / share
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvl_product_time ON public.product_view_log (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvl_created ON public.product_view_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_share_log (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id         uuid,
    platform        text NOT NULL DEFAULT 'whatsapp', -- whatsapp / telegram / copy
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psl_product ON public.product_share_log (product_id, created_at DESC);

-- Cache table — recomputed by the edge function on each call (cheap because we only count recent rows)
CREATE TABLE IF NOT EXISTS public.trending_cache (
    product_id      bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    views_24h       integer NOT NULL DEFAULT 0,
    shares_24h      integer NOT NULL DEFAULT 0,
    purchases_24h   integer NOT NULL DEFAULT 0,
    score           numeric(10,2) NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_view_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_share_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_cache     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvl_select" ON public.product_view_log;
CREATE POLICY "pvl_select" ON public.product_view_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "psl_select" ON public.product_share_log;
CREATE POLICY "psl_select" ON public.product_share_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "tc_select" ON public.trending_cache;
CREATE POLICY "tc_select" ON public.trending_cache FOR SELECT USING (true);

-- ============================================================================
-- 3. SELLER STORIES (Instagram-style, 24-hour expiry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seller_stories (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seller_id       uuid NOT NULL,
    -- 'product_spotlight' / 'deal' / 'behind_scenes' / 'announcement'
    story_type      text NOT NULL DEFAULT 'announcement' CHECK (story_type IN ('product_spotlight','deal','behind_scenes','announcement')),
    title           text NOT NULL DEFAULT '',
    body            text NOT NULL DEFAULT '',
    image_url       text,
    video_url       text,
    -- Optional link to a product
    product_id      bigint REFERENCES public.products(id) ON DELETE SET NULL,
    views_count     integer NOT NULL DEFAULT 0,
    expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ss_seller ON public.seller_stories (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ss_active ON public.seller_stories (expires_at, created_at DESC);

-- Track which users have viewed which stories (for "seen" state)
CREATE TABLE IF NOT EXISTS public.seller_story_views (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    story_id        bigint NOT NULL REFERENCES public.seller_stories(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL,
    viewed_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (story_id, user_id)
);

ALTER TABLE public.seller_stories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_story_views    ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ss_select" ON public.seller_stories;
CREATE POLICY "ss_select" ON public.seller_stories FOR SELECT USING (true);
DROP POLICY IF EXISTS "ssv_select" ON public.seller_story_views;
CREATE POLICY "ssv_select" ON public.seller_story_views FOR SELECT USING (true);

-- ============================================================================
-- 4. STORAGE BUCKET for product videos — created via separate API call
--    (We can't CREATE BUCKET from SQL; we'll do it via the management API.)
-- ============================================================================

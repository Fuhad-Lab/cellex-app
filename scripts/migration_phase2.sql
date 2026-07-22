-- ============================================================================
-- Cellex Phase 2: Community Engagement Schema Migration
-- ============================================================================
-- Adds:
--   1. Reviews & ratings — already have buyers_reviews; add aggregate cache
--   2. Group buying (Pinduoduo-style) — group_buys + group_buy_members
--   3. Wishlist sharing — shared_wishlists (with share tokens)
--   4. Live shopping (Whatnot-style) — live_sessions + live_messages
-- ============================================================================

-- ============================================================================
-- 1. REVIEWS & RATINGS — add seller aggregate cache + product rating cache
-- ============================================================================
-- We add a `product_ratings` cache table for fast product card lookups.
CREATE TABLE IF NOT EXISTS public.product_ratings (
    product_id    bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    avg_rating    numeric(3,2) NOT NULL DEFAULT 0,
    review_count  integer NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed from existing reviews (none currently, but for future-proofing)
INSERT INTO public.product_ratings (product_id, avg_rating, review_count)
SELECT product_id, AVG(rating)::numeric(3,2), COUNT(*)
FROM public.buyers_reviews
GROUP BY product_id
ON CONFLICT (product_id) DO NOTHING;

-- Trigger to recompute product_ratings on review insert/delete/update
CREATE OR REPLACE FUNCTION public.fn_recompute_product_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    pid bigint;
BEGIN
    pid := COALESCE(NEW.product_id, OLD.product_id);
    DELETE FROM public.product_ratings WHERE product_id = pid;
    INSERT INTO public.product_ratings (product_id, avg_rating, review_count)
    SELECT pid, COALESCE(AVG(rating), 0)::numeric(3,2), COUNT(*)
    FROM public.buyers_reviews
    WHERE product_id = pid;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reviews_recompute ON public.buyers_reviews;
CREATE TRIGGER trg_reviews_recompute
    AFTER INSERT OR DELETE OR UPDATE ON public.buyers_reviews
    FOR EACH ROW EXECUTE FUNCTION public.fn_recompute_product_rating();

-- Enable RLS
ALTER TABLE public.product_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pr_select" ON public.product_ratings;
CREATE POLICY "pr_select" ON public.product_ratings FOR SELECT USING (true);

-- ============================================================================
-- 2. GROUP BUYING (Pinduoduo-style)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.group_buys (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id       uuid NOT NULL,
    initiator_id    uuid NOT NULL,                    -- buyer who started it
    target_count    integer NOT NULL DEFAULT 3,        -- e.g. 3 friends
    current_count   integer NOT NULL DEFAULT 1,        -- initiator counts as 1
    discount_pct    numeric(5,2) NOT NULL DEFAULT 20,  -- e.g. 20.00 = 20% off
    status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','expired','cancelled')),
    expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_buys_status ON public.group_buys (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_group_buys_product ON public.group_buys (product_id, status);
CREATE INDEX IF NOT EXISTS idx_group_buys_initiator ON public.group_buys (initiator_id);

CREATE TABLE IF NOT EXISTS public.group_buy_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_buy_id    uuid NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL,
    joined_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_buy_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_buy_members_user ON public.group_buy_members (user_id);

-- When a member joins and target_count is reached, mark group as completed
CREATE OR REPLACE FUNCTION public.fn_group_buy_member_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.group_buys
        SET current_count = (SELECT COUNT(*) FROM public.group_buy_members WHERE group_buy_id = NEW.group_buy_id),
            status = CASE
              WHEN (SELECT COUNT(*) FROM public.group_buy_members WHERE group_buy_id = NEW.group_buy_id) >= target_count
              THEN 'completed' ELSE status END,
            completed_at = CASE
              WHEN (SELECT COUNT(*) FROM public.group_buy_members WHERE group_buy_id = NEW.group_buy_id) >= target_count
              THEN now() ELSE completed_at END
        WHERE id = NEW.group_buy_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.group_buys
        SET current_count = GREATEST(0, (SELECT COUNT(*) FROM public.group_buy_members WHERE group_buy_id = OLD.group_buy_id))
        WHERE id = OLD.group_buy_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_gbm_change ON public.group_buy_members;
CREATE TRIGGER trg_gbm_change
    AFTER INSERT OR DELETE ON public.group_buy_members
    FOR EACH ROW EXECUTE FUNCTION public.fn_group_buy_member_change();

ALTER TABLE public.group_buys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gb_select" ON public.group_buys;
CREATE POLICY "gb_select" ON public.group_buys FOR SELECT USING (true);
DROP POLICY IF EXISTS "gbm_select" ON public.group_buy_members;
CREATE POLICY "gbm_select" ON public.group_buy_members FOR SELECT USING (true);

-- ============================================================================
-- 3. WISHLIST SHARING
-- ============================================================================
-- Each share token represents a snapshot of a user's wishlist at share time.
CREATE TABLE IF NOT EXISTS public.shared_wishlists (
    token           text PRIMARY KEY,
    user_id         uuid NOT NULL,
    title           text NOT NULL DEFAULT 'My Cellex Wishlist',
    -- Cache the items JSON at share time so the share link works even after wishlist edits
    items_json      jsonb NOT NULL DEFAULT '[]'::jsonb,
    view_count      integer NOT NULL DEFAULT 0,
    expires_at      timestamptz,  -- NULL = never expires
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_wishlists_user ON public.shared_wishlists (user_id);

ALTER TABLE public.shared_wishlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sw_select" ON public.shared_wishlists;
CREATE POLICY "sw_select" ON public.shared_wishlists FOR SELECT USING (true);

-- ============================================================================
-- 4. LIVE SHOPPING (Whatnot-style) — separate from academy's live_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shop_live_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       uuid NOT NULL,
    title           text NOT NULL,
    description     text,
    -- For MVP: seller pastes a YouTube/HLS stream URL OR we use a "text-only live" mode
    stream_url      text,
    stream_platform text DEFAULT 'none' CHECK (stream_platform IN ('none','youtube','twitch','hls','rtmp')),
    status          text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
    featured_product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
    viewer_count    integer NOT NULL DEFAULT 0,
    started_at      timestamptz,
    ended_at        timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_live_sessions_status ON public.shop_live_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_live_sessions_seller ON public.shop_live_sessions (seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_live_messages (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    live_session_id uuid NOT NULL REFERENCES public.shop_live_sessions(id) ON DELETE CASCADE,
    user_id         uuid,                          -- NULL for system messages
    user_name       text NOT NULL DEFAULT 'Anonymous',
    message         text NOT NULL,
    -- Special message types: chat, join, leave, purchase, system
    msg_type        text NOT NULL DEFAULT 'chat' CHECK (msg_type IN ('chat','join','leave','purchase','system')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_live_messages_session ON public.shop_live_messages (live_session_id, created_at DESC);

-- Live viewer tracking — so we can count current viewers and increment/decrement on join/leave
CREATE TABLE IF NOT EXISTS public.shop_live_viewers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    live_session_id uuid NOT NULL REFERENCES public.shop_live_sessions(id) ON DELETE CASCADE,
    user_id         uuid,
    user_name       text NOT NULL DEFAULT 'Anonymous',
    joined_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (live_session_id, user_id)
);

ALTER TABLE public.shop_live_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_live_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_live_viewers   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sls_select" ON public.shop_live_sessions;
CREATE POLICY "sls_select" ON public.shop_live_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "slm_select" ON public.shop_live_messages;
CREATE POLICY "slm_select" ON public.shop_live_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "slv_select" ON public.shop_live_viewers;
CREATE POLICY "slv_select" ON public.shop_live_viewers FOR SELECT USING (true);

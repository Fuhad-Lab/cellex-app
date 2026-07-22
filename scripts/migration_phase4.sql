-- ============================================================================
-- Cellex Phase 4: Cross-platform integration
-- ============================================================================
-- Adds:
--   1. user_phone_links — maps WhatsApp phone numbers to user IDs
--   2. telegram_subscribers — users who want Telegram alerts
--   3. broadcast_log — history of Telegram broadcasts
-- ============================================================================

-- WhatsApp phone ↔ user_id mapping
CREATE TABLE IF NOT EXISTS public.user_phone_links (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      uuid NOT NULL,
    phone        text NOT NULL,                          -- E.164 format: +234...
    link_code    text NOT NULL,                          -- 6-digit code used to confirm linking
    confirmed_at timestamptz,                            -- NULL = pending, set when bot confirms
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, phone),
    UNIQUE (link_code)
);

CREATE INDEX IF NOT EXISTS idx_upl_phone ON public.user_phone_links (phone) WHERE confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upl_user ON public.user_phone_links (user_id);

-- Telegram subscribers (chat IDs that have /subscribed to our bot)
CREATE TABLE IF NOT EXISTS public.telegram_subscribers (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_chat_id  bigint NOT NULL,
    telegram_username text,
    user_id           uuid,                               -- may be NULL if not linked to Cellex
    subscribed_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (telegram_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_ts_user ON public.telegram_subscribers (user_id);

-- Broadcast log (history of messages pushed to Telegram channel/subscribers)
CREATE TABLE IF NOT EXISTS public.broadcast_log (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    broadcast_type    text NOT NULL,                      -- new_product / flash_sale / live_start / group_buy / manual
    entity_id         text,                               -- product_id / session_id / group_buy_id
    message           text NOT NULL,
    recipients_count  integer NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bl_created ON public.broadcast_log (created_at DESC);

ALTER TABLE public.user_phone_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_subscribers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_log           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upl_select" ON public.user_phone_links;
CREATE POLICY "upl_select" ON public.user_phone_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "ts_select" ON public.telegram_subscribers;
CREATE POLICY "ts_select" ON public.telegram_subscribers FOR SELECT USING (true);
DROP POLICY IF EXISTS "bl_select" ON public.broadcast_log;
CREATE POLICY "bl_select" ON public.broadcast_log FOR SELECT USING (true);

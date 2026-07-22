-- ============================================================================
-- Cellex Payment Gateway — PalmPay manual transfer verification
-- ============================================================================
-- Customers transfer money to PalmPay, we verify by checking Gmail for
-- the PalmPay transaction alert email that matches the order amount.
-- ============================================================================

-- Payment orders table
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            text UNIQUE NOT NULL,                     -- human-readable, e.g. "CELLEX-1234567890"
    buyer_id            uuid,                                     -- auth.users.id (nullable for guest checkout)
    buyer_email         text NOT NULL,
    buyer_name          text NOT NULL,
    buyer_phone         text,
    
    -- The order total with a unique decimal suffix (e.g. 5000.23)
    -- The suffix makes each order amount unique so we can match it to
    -- exactly one PalmPay alert email.
    expected_amount     numeric(12,2) NOT NULL,
    currency            text NOT NULL DEFAULT 'NGN',
    
    -- Order details (what was purchased)
    items_summary       text NOT NULL,                            -- e.g. "2x Drone, 1x Book"
    item_count          integer NOT NULL DEFAULT 1,
    
    -- Status lifecycle: pending → awaiting_verification → matched / expired
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','awaiting_verification','matched','expired','cancelled')),
    
    -- When the user clicks "I've sent it"
    verification_started_at  timestamptz,
    
    -- When a matching PalmPay email was found
    matched_at              timestamptz,
    matched_email_id        text,      -- Gmail message ID (prevents reuse)
    matched_sender_name     text,      -- sender name from the PalmPay alert
    matched_amount          numeric(12,2), -- actual amount found in email
    
    -- Expiry
    expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_order_id ON public.payment_orders (order_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_po_buyer ON public.payment_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_po_matched_email ON public.payment_orders (matched_email_id);

-- Rate limiting: track confirm-sent calls per IP + per order
CREATE TABLE IF NOT EXISTS public.payment_rate_limits (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        text NOT NULL,
    ip_address      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prl_order ON public.payment_rate_limits (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prl_ip ON public.payment_rate_limits (ip_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_rate_limits ENABLE ROW LEVEL SECURITY;

-- Public can read their own order status (by order_id) but can't see sensitive fields
DROP POLICY IF EXISTS "po_select" ON public.payment_orders;
CREATE POLICY "po_select" ON public.payment_orders FOR SELECT USING (true);

-- Only edge functions (service role) can INSERT/UPDATE
DROP POLICY IF EXISTS "po_insert" ON public.payment_orders;
CREATE POLICY "po_insert" ON public.payment_orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "po_update" ON public.payment_orders;
CREATE POLICY "po_update" ON public.payment_orders FOR UPDATE USING (true);

-- Rate limits: anyone can insert (edge function handles validation)
DROP POLICY IF EXISTS "prl_insert" ON public.payment_rate_limits;
CREATE POLICY "prl_insert" ON public.payment_rate_limits FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "prl_select" ON public.payment_rate_limits;
CREATE POLICY "prl_select" ON public.payment_rate_limits FOR SELECT USING (true);

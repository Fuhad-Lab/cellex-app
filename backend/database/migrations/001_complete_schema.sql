-- ============================================================================
-- Cellex Database Schema — Production-Grade with Strict RLS
-- ============================================================================
-- This schema defines ALL tables, indexes, constraints, and RLS policies.
-- RLS is the LAST line of defense. Edge Functions + NestJS are the first.
-- ============================================================================

-- ============================================================================
-- 1. PROFILES (Buyer profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. SELLERS (Seller accounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sellers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_description text DEFAULT '',
  business_category text DEFAULT 'General',
  business_location text DEFAULT '',
  profile_image text DEFAULT '',
  slug text UNIQUE,
  phone text DEFAULT '',
  contact_phone text DEFAULT '',
  address text DEFAULT '',
  state text DEFAULT '',
  seller_type text DEFAULT 'individual',
  avatar_script text,
  avatar_language text DEFAULT 'en',
  avatar_audio_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sellers_select_all ON public.sellers FOR SELECT USING (true); -- Public storefronts
CREATE POLICY sellers_update_own ON public.sellers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY sellers_insert_own ON public.sellers FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 3. PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id serial PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(12,2) NOT NULL CHECK (price > 0),
  image_url text DEFAULT '',
  additional_images text[] DEFAULT '{}',
  category text DEFAULT 'General',
  units_sold integer DEFAULT 0,
  stock integer DEFAULT 100,
  video_url text,
  group_buy_enabled boolean DEFAULT false,
  group_buy_target_count integer DEFAULT 3,
  group_buy_discount_pct integer DEFAULT 20,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_created ON public.products(created_at DESC);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select_active ON public.products FOR SELECT USING (status = 'active');
CREATE POLICY products_insert_own ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY products_update_own ON public.products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY products_delete_own ON public.products FOR DELETE USING (auth.uid() = seller_id);

-- ============================================================================
-- 4. CART ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_user_product ON public.cart_items(user_id, product_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cart_select_own ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cart_insert_own ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cart_update_own ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cart_delete_own ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.buyers_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total numeric(12,2) NOT NULL CHECK (total > 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_ref text,
  paid_at timestamptz,
  shipping_name text,
  shipping_phone text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  items_count integer DEFAULT 0,
  items_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.buyers_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.buyers_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.buyers_orders(created_at DESC);

ALTER TABLE public.buyers_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select_own ON public.buyers_orders FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE only via service role (NestJS) — no direct user INSERT

-- ============================================================================
-- 6. ORDER ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.buyers_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.buyers_orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price > 0),
  total numeric(12,2) NOT NULL CHECK (total > 0),
  seller_id uuid REFERENCES public.sellers(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.buyers_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.buyers_order_items(seller_id);

ALTER TABLE public.buyers_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_select_own ON public.buyers_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.buyers_orders WHERE id = order_id AND user_id = auth.uid())
  );

-- ============================================================================
-- 7. PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.buyers_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference text UNIQUE NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'NGN',
  channel text DEFAULT 'card',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  paystack_response jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select_own ON public.payments FOR SELECT USING (auth.uid() = user_id);
-- INSERT only via service role (NestJS after Paystack verification)

-- ============================================================================
-- 8. FEED POSTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id serial PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('video', 'photo', 'text', 'story')),
  product_id integer REFERENCES public.products(id),
  caption text DEFAULT '',
  media_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  views_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'flagged')),
  story_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_seller ON public.feed_posts(seller_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON public.feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON public.feed_posts(status);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY feed_posts_select_active ON public.feed_posts FOR SELECT
  USING (status = 'active' AND (story_expires_at IS NULL OR story_expires_at > now()));
CREATE POLICY feed_posts_insert_own ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY feed_posts_update_own ON public.feed_posts FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY feed_posts_delete_own ON public.feed_posts FOR DELETE USING (auth.uid() = seller_id);

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id serial PRIMARY KEY,
  post_type text NOT NULL,
  post_id integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text text NOT NULL CHECK (length(comment_text) > 0 AND length(comment_text) <= 1000),
  user_name text DEFAULT 'User',
  user_image text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.feed_comments(post_type, post_id);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_select_all ON public.feed_comments FOR SELECT USING (true);
CREATE POLICY comments_insert_own ON public.feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY comments_delete_own ON public.feed_comments FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 10. CONVERSATIONS + MESSAGES (Chat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text DEFAULT 'direct' CHECK (type IN ('direct', 'group_buy', 'group')),
  is_group boolean DEFAULT false,
  name text,
  participant1 uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  participant2 uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_buy_id uuid,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY convos_select_participant ON public.conversations FOR SELECT
  USING (auth.uid() = participant1 OR auth.uid() = participant2);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_members_select ON public.conversation_members FOR SELECT USING (true);
CREATE POLICY conv_members_insert ON public.conversation_members FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_content text NOT NULL,
  iv text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select_participant ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant1 = auth.uid() OR c.participant2 = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
  );
CREATE POLICY messages_insert_participant ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.buyers_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text DEFAULT '',
  message text DEFAULT '',
  data jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user ON public.buyers_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_unread ON public.buyers_notifications(user_id) WHERE read = false;

ALTER TABLE public.buyers_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifs_select_own ON public.buyers_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifs_update_own ON public.buyers_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY notifs_insert_own ON public.buyers_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 12. WISHLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.buyers_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.buyers_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY wishlist_select_own ON public.buyers_wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wishlist_insert_own ON public.buyers_wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wishlist_delete_own ON public.buyers_wishlist FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 13. GROUP BUYS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.group_buys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  initiator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_count integer NOT NULL CHECK (target_count >= 2),
  current_count integer DEFAULT 1,
  discount_pct integer NOT NULL CHECK (discount_pct > 0 AND discount_pct < 100),
  status text DEFAULT 'open' CHECK (status IN ('open', 'completed', 'expired', 'cancelled')),
  invite_code text UNIQUE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id),
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_buys_product ON public.group_buys(product_id);
CREATE INDEX IF NOT EXISTS idx_group_buys_invite ON public.group_buys(invite_code);

ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_buys_select_all ON public.group_buys FOR SELECT USING (true);
-- INSERT/UPDATE only via service role (Edge Functions)

-- ============================================================================
-- 14. AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  request_id text,
  method text NOT NULL,
  path text NOT NULL,
  status text DEFAULT 'success',
  error_message text,
  duration_ms integer,
  request_body jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);

-- NO RLS on audit_log — only service role can INSERT/SELECT (for forensics)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated users. Only service role.

-- ============================================================================
-- 15. PRODUCT EMBEDDINGS (pgvector for semantic search)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_embeddings (
  product_id integer PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  embedding vector(1024),
  search_text text,
  name text,
  category text,
  price numeric,
  image_url text
);

CREATE INDEX IF NOT EXISTS idx_product_embeddings
  ON public.product_embeddings USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.product_embeddings ENABLE ROW LEVEL SECURITY;
-- No policies = only service role can read/write embeddings

-- ============================================================================
-- 16. SELLER FOLLOWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seller_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_seller ON public.seller_follows(seller_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.seller_follows(follower_id);

ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select_all ON public.seller_follows FOR SELECT USING (true);
CREATE POLICY follows_insert_own ON public.seller_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete_own ON public.seller_follows FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================================
-- 17. WEB SESSIONS (Session management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.web_sessions (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.web_sessions(user_id);

ALTER TABLE public.web_sessions ENABLE ROW LEVEL SECURITY;
-- No policies = only service role can read/write sessions

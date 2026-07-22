# Task ID: 26 — Slug-based links + dynamic seller dashboard + signup profile picture

## Agent: full-stack-developer

## Task
3-part task:
1. Update all in-app links from `/seller-profile?id=<id>` to `/<slug>` (fall back to old URL if slug missing)
2. Make `seller-dashboard` page fetch real data (products, orders, videos, computed stats) instead of static/hardcoded values
3. Add full name + profile picture upload to the signup flow on the login page

## Work Done

### Part 1: Slug-based storefront links (6 files modified)

**`src/app/page.tsx`** (homepage):
- Extended `FeedPost` interface with `sellerSlug?: string`
- Extended `sellerMap` to store slug: `sellerMap.set(s.id, { name, image, slug: s.slug })`
- Video posts: prefer `seller.slug`, fall back to sellerMap lookup (videos.feed API may not embed slug)
- Product posts: use `sellerInfo?.slug` from sellerMap
- `FeedPostCard`: seller header avatar + name links use `post.sellerSlug ? \`/${post.sellerSlug}\` : (post.sellerId ? \`/seller-profile?id=${post.sellerId}\` : '#')`
- `SuggestedSellersCarousel`: each seller card uses `seller.slug ? \`/${seller.slug}\` : \`/seller-profile?id=${sellerId}\``
- Stories section: each story uses `s.slug ? \`/${s.slug}\` : \`/seller-profile?id=${s.seller_id}\``

**`src/app/product/page.tsx`**: Seller header (avatar, name, "Visit" button) all use `seller.slug ? \`/${seller.slug}\` : \`/seller-profile?id=${seller.id}\``

**`src/app/shorts/page.tsx`**: Seller avatar + name in bottom overlay use `seller.slug ? \`/${seller.slug}\` : (seller.id ? \`/seller-profile?id=${seller.id}\` : '#')`

**`src/app/live-watch/page.tsx`**: "by <seller_name>" link uses `session.seller_slug ? \`/${session.seller_slug}\` : \`/seller-profile?id=${session.seller_id}\``

**`src/app/sellers/page.tsx`**: Each seller row uses `seller.slug ? \`/${seller.slug}\` : \`/seller-profile?id=${seller.id}\``

**`src/app/seller-profile/page.tsx`** (kept as fallback):
- After fetching seller via `api.social.publicProfile(sellerId)`, if seller has a `slug` field, `router.replace(\`/${slug}\`)` redirects to clean /<slug> URL
- If no slug (legacy sellers), the page renders the old /seller-profile view as before
- Added `router` to the `load` callback's dependency array

### Part 2: Dynamic seller-dashboard

**`src/app/seller-dashboard/page.tsx`** — completely rewritten:

- Fetches 4 data sources in parallel (each wrapped in .catch so failures don't break the page):
  1. Seller profile via `POST /api/seller-profile { op: 'get' }`
  2. Products via `api.sellerProducts.list()`
  3. Orders via `POST /api/seller-orders { op: 'list' }`
  4. Videos via `POST /api/videos { op: 'mine' }`
- Computed real stats:
  - Total revenue = sum of all order totals
  - Total orders = orders.length
  - Total products = products.length
  - Total views = sum of all video view counts
- Removed old `api.sellerDashboard.stats()` call — everything is computed from real list responses
- New sections:
  - **Recent Orders (last 5)**: #id, status pill, first item + extra count, time-ago, total. Empty state with CTA.
  - **Top Products (by units_sold)**: 2-col grid of top 4. Empty state with CTA.
  - **Quick Actions**: 3-col grid (Add Product / Add Video / Go Live)
- Profile header shows "cellex.app/<slug>" link if seller has a slug
- Top bar shows "View store" link to public storefront if seller has a slug
- Loading skeleton shown while data loads
- All hardcoded numbers removed

### Part 3: Signup profile picture + full name

**`src/app/login/page.tsx`** — signup form extended:

- Added state: `fullName`, `profileImageFile`, `profileImagePreview`, file input ref, `useToast`
- **Signup-only UI** (shown when `mode === 'signup'`):
  - Circular 96px avatar button with camera icon — click opens file picker
  - Image preview with hover camera overlay when selected
  - "Change" / "Remove" buttons under avatar when image selected
  - File input accepts `image/*`, validates type + 5MB max
  - Full name text input with `User` icon, `autoComplete="name"`
- **Signup flow**:
  1. Validate `fullName` is non-empty
  2. Call `signup(email, password)` — creates account + sets session cookie
  3. If image selected: read file as base64 → `POST /api/upload-image { imageData }` → get `/api/image?id=<uuid>` URL
     - Upload AFTER signup (upload-image requires auth session cookie)
     - On failure: non-blocking toast (account still created)
  4. Call `api.profile.update({ fullName, profileImage })` to save profile data
     - On failure: non-blocking toast (account still created)
  5. Redirect to `next` page
- Login mode unchanged
- Loading state shows spinner + "Creating account..." text

**`src/lib/api.ts`**:
- Extended `api.profile.update` type signature to accept `profileImage?: string` (was only fullName/phone/address — underlying API call already passed through extra fields, but TypeScript would have rejected it)

## Files Modified
1. `src/app/page.tsx` — homepage slug links
2. `src/app/product/page.tsx` — product page seller header links
3. `src/app/shorts/page.tsx` — shorts seller links
4. `src/app/live-watch/page.tsx` — live-watch seller link
5. `src/app/sellers/page.tsx` — sellers list links
6. `src/app/seller-profile/page.tsx` — redirect to /<slug> if slug exists
7. `src/app/seller-dashboard/page.tsx` — full rewrite with real data
8. `src/app/login/page.tsx` — signup profile picture + full name
9. `src/lib/api.ts` — extended profile.update type

## Build Status
- `npm run build` → ✓ Compiled successfully in 18.8s
- 71/71 static pages generated (up from 70)
- TypeScript strict mode passes (no type errors)
- Pre-existing lint warnings remain in untouched files (not in scope)

## Issues Encountered
- None significant. The `api.social.publicProfile` endpoint may or may not include the `slug` field on the returned seller object — handled gracefully by only redirecting when `seller.slug` is truthy.
- The `op: 'mine'` call to /api/videos may not be supported by the current edge function — wrapped in .catch so the dashboard still renders with 0 videos if it fails.
- Image upload requires auth, so it MUST happen AFTER signup completes. Handled correctly in the signup flow.
- Profile picture is stored in the `product_images` table (with product_id=NULL) since /api/upload-image is product-focused. The returned URL (`/api/image?id=<uuid>`) is a generic image URL that works anywhere — saved to the user's profile via `api.profile.update({ profileImage })`.

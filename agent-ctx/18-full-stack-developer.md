# Task ID: 18 — IG UI rewrite (all remaining pages)

## Agent: full-stack-developer

## Task
Apply Instagram-style UI to all 33 remaining pages of the Cellex social-commerce platform.

## Work Done
Rewrote 33 pages + seller/layout.tsx to use the IG design system already established in globals.css:

### Pages (in order):
1. `/cart` — single-column, sticky bottom checkout bar
2. `/checkout` — sticky bottom place-order bar, neutral inputs
3. `/search` — replaced ▶ with Play icon
4. `/categories` — removed emojis + fake badges, IG pills
5. `/wishlist` — divide-y list
6. `/messenger` — black AI widget, IG chat bubbles
7. `/orders` — IG list rows with chevron expand
8. `/profile` — IG profile header (77px avatar + 3 stats + Edit profile outlined button)
9. `/settings` — sectioned IG list rows
10. `/live` — IG cards with no shadow
11. `/live-watch` — single-column stack with stream + chat
12. `/videos` — IG Reels-style (kept black bg, replaced brand-gradient with bg-black, ✓/+ icons)
13. `/sellers` — divide-y seller list with avatar + product thumbs
14. `/notifications` — IG activity feed with IG-blue unread dot
15. `/ai-chat` — IG DM-style chat bubbles
16. `/become-seller` — IG-style 3-step form
17. `/link-account` — IG-style outlined cards
18. `/telegram` — neutral cards (kept Telegram blue brand color)
19. `/group-buy` — black hero header
20. `/group-buy-join` — black hero circle, neutral cards
21. `/payment` — IG-style stepper, neutral info boxes
22. `/login` — centered card on white bg
23. `/create` — IG-style top bar with X close
24. `/seller-dashboard` — IG profile header + 4-stat grid + sectioned menu
25. `/seller` — neutral cards (removed colored stat backgrounds)
26. `/seller/orders` — neutral cards with status pill
27. `/seller/profile` — edit form with neutral inputs
28. `/seller/go-live` — added camera preview placeholder
29. `/seller/videos` — grid of 9:16 thumbnails
30. `/seller/stories` — grid of 9:16 thumbnails with overlay
31. `/seller/settings` — sectioned IG list rows
32. `/seller/academy` — neutral Coming Soon card
33. `/seller/preparing` — kept animated loading, neutral colors
- `/seller/layout.tsx` — sidebar now uses bg-black for active state

## Build Status
- Build passes with strict TypeScript (no errors)
- 69 static pages generated
- Lint shows only pre-existing React 19 hook warnings (not in scope)

## Decisions / Non-trivial Changes
- Removed ALL emoji icons in UI chrome (🛍️📱👗🏠💄🌱⚽🍲🧸📚🔥👀✨🎉⚡👑 etc.) — replaced with Lucide icons or removed entirely
- Removed fake FOMO: countdown timers, "100+ joined" badges, "Limited Offer" FABs, "Bestseller" badges, "Hot" badges, "With Coupon" labels
- Removed fake "AI Shopping" promo card on login page
- Replaced `brand-gradient` → `bg-black` everywhere (the class itself was already set to pure black in globals.css, so visual change was zero, but class names needed cleanup per task instructions)
- Replaced `text-primary` → `text-black`, `bg-primary` → `bg-black`
- Replaced `text-slate-*` → `text-neutral-*`, `border-slate-*` → `border-neutral-*`
- Used `divide-y divide-neutral-100` for list rows instead of bordered cards
- Used IG button style: `bg-black text-white font-semibold rounded-md px-4 py-2.5 hover:bg-neutral-800`
- Used IG input style: `bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400`

## Commit
- GitHub: 0e6aa2c pushed to Fuhad-Lab/cellex-app main
- 35 files changed, +2266 / -2511 lines

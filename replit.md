# Cellex Marketplace

Nigeria's #1 social commerce marketplace. A social ecommerce platform with live shopping, group buys, and AI-powered product discovery.

## Architecture

This is a **pnpm monorepo** (pnpm workspace) with:
- `artifacts/cellex/` — React + Vite frontend (the main web app at `/`)
- `artifacts/api-server/` — Express backend (scaffolded, at `/api`)
- `lib/api-spec/` — OpenAPI spec
- `lib/api-client-react/` — Generated React Query hooks
- `lib/db/` — Drizzle ORM + PostgreSQL

## Frontend (`artifacts/cellex`)

Originally a Next.js app, now converted to **Vite + React** with:
- **Routing**: wouter (all routes defined in `src/App.tsx`)
- **Styling**: Tailwind v4 + custom Cellex design tokens (champagne gold `#D4AF37`, white, black)
- **Fonts**: Plus Jakarta Sans + Sora (Google Fonts, loaded in `index.html`)
- **State**: React context (`AuthProvider`, `OptimisticUIProvider`) + TanStack Query
- **API**: Custom `api` client in `src/lib/api.ts` — calls `/api/*` endpoints on the external Supabase backend

## Backend

The app's data is served by a **Supabase-hosted backend** (external). The `api.ts` client calls `/api/*` which proxies to Supabase edge functions. The `artifacts/api-server` scaffold is available for future Express routes.

## Key files
- `artifacts/cellex/src/App.tsx` — all routes
- `artifacts/cellex/src/lib/api.ts` — API client
- `artifacts/cellex/src/lib/navigation.ts` — next/navigation compatibility shim (usePathname, useRouter, useSearchParams)
- `artifacts/cellex/src/index.css` — Cellex design tokens + global styles
- `artifacts/cellex/index.html` — Google Fonts, viewport meta

## Running the app

The workflow `artifacts/cellex: web` runs the Vite dev server. It is managed by Replit — do not run `pnpm dev` at the root.

## User preferences

- Keep the Cellex design: white background, black text, champagne gold (`#D4AF37`) accents
- Mobile-first layout (max 470px container for feed, dark glass bottom nav)
- Instagram-inspired social commerce feel

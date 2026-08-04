# Cellex Search Page — Design Specification

> Based on research of Google Search's results page layout, visual hierarchy, and
> design language (2024–2025). Adapted for Cellex with a **strict black & white**
> palette (no gold/yellow), Google-like minimalism, and mobile-first responsiveness.

---

## 1. Research Summary: How Google's SERP Is Structured

Based on analysis of Google's official [Visual Elements Gallery](https://developers.google.com/search/docs/appearance/visual-elements-gallery), the Google Blog post on [Generative AI in Search](https://blog.google/products-and-platforms/products/search/generative-ai-google-search-may-2024), [The Verge's coverage](https://www.theverge.com/2024/5/14/24155321/google-search-ai-results-page-gemini-overview), [Wikipedia's AI Overviews article](https://en.wikipedia.org/wiki/AI_Overviews), and [GoodUI's leaked A/B tests on link colors](https://goodui.org/leaks/google-has-been-a-b-testing-link-colors-again-and-this-light-blue-didnt-pass):

### Google's page anatomy (top → bottom)
1. **Sticky header** — Google logo (small) + search bar (rounded pill, with mic/lens icons). Stays fixed on scroll.
2. **Tab bar** — All, Images, Videos, News, Shopping, Maps, etc. Active tab = blue text + bottom underline. Inactive = gray text.
3. **Tools/filter row** (collapsible) — "Tools", "Any time", "All results", etc.
4. **AI Overview** (when triggered) — A distinct card at the very top of results, taking up ~67% of desktop / ~75% of mobile viewport height. Concise AI-generated summary with source link chips. Has a subtle gradient/border accent (Google uses blue→purple).
5. **Organic text results** — Each result: favicon + URL breadcrumb (small gray) → title link (large blue `#1a0dab`, ~18–20px) → snippet (dark gray, ~14px).
6. **Rich / image / video results** — Mixed in based on query intent.
7. **People Also Ask / Related searches** — Exploration features at the bottom.
8. **Knowledge Panel** — Right column on desktop (entity info), hidden on mobile.

### Key findings
- **Title link color**: `#1a0dab` (Google's classic blue — kept after testing 41 shades; lighter variants were rejected for lower contrast).
- **Visited link color**: `#681da8` (purple).
- **Snippet text color**: `#4d5156` / `#202124` (dark gray, near-black).
- **URL/breadcrumb color**: `#5f6368` (medium gray).
- **Title font size**: ~18–20px Arial (Google uses Arial/Roboto system stack).
- **Snippet font size**: ~14px.
- **AI Overviews** appear at the TOP of results, occupy majority of screen, have a card container with rounded corners and a gradient accent border.
- **Overall feel**: Minimal, white background, generous whitespace, left-aligned results column (~600–700px wide on desktop), system fonts.

---

## 2. Cellex Adaptation: Black & White Only

Google uses blue links + purple visited + colorful logo + AI gradient. **Cellex must use ONLY black & white.** Translation:

| Google | Cellex (B&W) |
|---|---|
| Blue link `#1a0dab` | Black `#000000` (links) or underlined black |
| Visited purple `#681da8` | Dark gray `#525252` (visited) |
| Colorful Google logo | Cellex wordmark in black |
| Blue→purple AI gradient accent | Thin black border / subtle gray fill `#f5f5f5` |
| Gray URL breadcrumb | Gray `#737373` |
| White background `#ffffff` | White background `#ffffff` |
| Dark text `#202124` | Near-black text `#171717` |

---

## 3. Final Design Spec for Cellex

### 3.1 Color Tokens

```css
:root {
  /* Core palette — black & white only */
  --cx-bg:            #ffffff;   /* page background */
  --cx-surface:       #ffffff;   /* cards, search bar */
  --cx-surface-muted: #f5f5f5;   /* AI answer card fill, hover states */
  --cx-border:        #e5e5e5;   /* search bar border, dividers */
  --cx-border-strong: #d4d4d4;   /* focused/active borders */

  /* Text */
  --cx-text:          #171717;   /* primary text, titles, links (black) */
  --cx-text-secondary:#525252;   /* snippets, descriptions, visited */
  --cx-text-muted:    #737373;   /* URLs, breadcrumbs, meta */
  --cx-text-faint:    #a3a3a3;   /* placeholder, timestamps */

  /* Interactive */
  --cx-hover:         #f5f5f5;   /* hover backgrounds */
  --cx-active:        #171717;   /* active tab underline, active states */
  --cx-inverse:       #ffffff;   /* text on black */

  /* NO yellow, NO gold, NO blue, NO purple — strictly grayscale */
}
```

### 3.2 Typography

```css
:root {
  /* Font stack — system, like Google's Arial/Roboto approach */
  --cx-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                  Helvetica, Arial, sans-serif;

  /* Sizes (mobile-first, scale up on desktop) */
  --cx-text-xs:   11px;   /* tab labels meta */
  --cx-text-sm:   13px;   /* URL/breadcrumb, secondary meta */
  --cx-text-base: 14px;   /* snippets, body, AI answer body */
  --cx-text-md:   16px;   /* search input, tab labels */
  --cx-text-lg:   18px;   /* result titles (mobile) */
  --cx-text-xl:   20px;   /* result titles (desktop) */
  --cx-text-2xl:  22px;   /* AI answer heading */

  /* Weights */
  --cx-fw-regular:  400;
  --cx-fw-medium:   500;
  --cx-fw-semibold: 600;

  /* Line heights */
  --cx-leading-tight:  1.25;
  --cx-leading-normal: 1.5;
}
```

### 3.3 Spacing & Layout

```css
:root {
  /* Spacing scale (8px base, like Google Material) */
  --cx-space-1:  4px;
  --cx-space-2:  8px;
  --cx-space-3:  12px;
  --cx-space-4:  16px;
  --cx-space-5:  20px;
  --cx-space-6:  24px;
  --cx-space-8:  32px;
  --cx-space-10: 40px;

  /* Radii — Google uses gentle rounding; Cellex matches */
  --cx-radius-sm:   8px;    /* small chips, buttons */
  --cx-radius-md:   12px;   /* cards */
  --cx-radius-full: 9999px; /* search bar pill, pills */

  /* Layout widths */
  --cx-content-max:   692px;  /* results column (matches Google) */
  --cx-content-pad:   16px;   /* mobile side padding */
  --cx-content-pad-d: 24px;   /* desktop side padding */

  /* Shadows */
  --cx-shadow-bar: 0 1px 6px rgba(32,33,36,0.08);   /* search bar focus */
  --cx-shadow-card: 0 1px 3px rgba(0,0,0,0.06);      /* AI answer card */
}
```

---

## 4. Component Specifications

### 4.1 Header / Top Bar (sticky)

**Layout** (mobile-first):
```
┌──────────────────────────────────────┐
│  [Cellex]  [🔍 search query...    ✕] │  ← sticky, white, 1px bottom border
└──────────────────────────────────────┘
```
**Desktop**: logo + search bar left-aligned, search bar grows to ~`min(640px, 100%)`.

```css
.cx-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--cx-bg);
  border-bottom: 1px solid var(--cx-border);
  padding: 12px var(--cx-content-pad);
}
.cx-header__inner {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 692px;          /* matches results column on desktop */
  margin: 0 auto;
}
.cx-logo {
  font-size: 20px;
  font-weight: 600;
  color: var(--cx-text);
  letter-spacing: -0.02em;   /* tight, modern */
  white-space: nowrap;
}
```

### 4.2 Search Bar

Google's search bar is a rounded pill, light gray border, subtle shadow on focus, with a search icon on the left and clear/voice icons on the right.

```css
.cx-searchbar {
  flex: 1;
  display: flex;
  align-items: center;
  height: 44px;              /* touch-friendly */
  padding: 0 16px;
  background: var(--cx-surface);
  border: 1px solid var(--cx-border);
  border-radius: var(--cx-radius-full);
  transition: box-shadow .15s, border-color .15s;
}
.cx-searchbar:focus-within {
  border-color: var(--cx-border-strong);
  box-shadow: var(--cx-shadow-bar);
}
.cx-searchbar input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: var(--cx-text-md);
  color: var(--cx-text);
}
.cx-searchbar input::placeholder { color: var(--cx-text-faint); }
.cx-searchbar__icon { color: var(--cx-text-muted); flex-shrink: 0; }
.cx-searchbar__clear { color: var(--cx-text-muted); cursor: pointer; }
```

### 4.3 Tab Bar

Google's tabs: **All, Images, Videos, News, Shopping, Maps**. Active = blue text + bottom underline; inactive = gray.

**Cellex tabs**: `AI Answer`, `Products`, `Videos` (e-commerce marketplace).

```
┌──────────────────────────────────────┐
│  AI Answer   Products   Videos       │
│  ─────────                            │  ← active underline (black)
└──────────────────────────────────────┘
```

```css
.cx-tabs {
  position: sticky;
  top: 69px;                 /* below header */
  z-index: 40;
  background: var(--cx-bg);
  border-bottom: 1px solid var(--cx-border);
}
.cx-tabs__inner {
  display: flex;
  gap: 4px;
  max-width: 692px;
  margin: 0 auto;
  padding: 0 var(--cx-content-pad);
  overflow-x: auto;
  scrollbar-width: none;     /* hide on mobile */
}
.cx-tabs__inner::-webkit-scrollbar { display: none; }
.cx-tab {
  position: relative;
  padding: 14px 12px;
  font-size: var(--cx-text-sm);
  font-weight: var(--cx-fw-medium);
  color: var(--cx-text-muted);
  white-space: nowrap;
  background: none;
  border: none;
  cursor: pointer;
  transition: color .15s;
}
.cx-tab:hover { color: var(--cx-text-secondary); }
.cx-tab--active {
  color: var(--cx-text);     /* black */
}
.cx-tab--active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;              /* overlaps border */
  height: 3px;
  background: var(--cx-active);  /* black */
  border-radius: 3px 3px 0 0;
}
```

**Desktop tweak**: tabs left-aligned, slightly larger font (`--cx-text-base`), more horizontal padding (`16px`).

### 4.4 AI Answer Card (Cellex equivalent of Google's AI Overview)

Google's AI Overview: a card at the very top of results, ~67% desktop / ~75% mobile viewport, rounded corners, subtle background, "Overview" label, AI-generated summary, source link chips. Google uses a blue→purple gradient accent.

**Cellex version**: Same prominent placement, but **black & white** — use a subtle gray fill (`#f5f5f5`) + thin border, a black "AI Answer" label chip, and a thin black left accent bar (instead of gradient).

```
┌──────────────────────────────────────┐
│ ▌ AI Answer                          │  ← label with black accent bar
│ ┌──────────────────────────────────┐ │
│ │ Cellex's AI summary paragraph... │ │  ← card body, gray fill
│ │ More context about the query.    │ │
│ │                                  │ │
│ │ Sources: [chip] [chip] [chip]    │ │  ← source link chips
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

```css
.cx-ai-answer {
  margin: 16px 0 24px;
}
.cx-ai-answer__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--cx-text-sm);
  font-weight: var(--cx-fw-semibold);
  color: var(--cx-text);
  margin-bottom: 12px;
  padding-left: 12px;
  position: relative;
}
.cx-ai-answer__label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 3px;
  background: var(--cx-text);    /* black accent bar */
  border-radius: 3px;
}
.cx-ai-answer__card {
  background: var(--cx-surface-muted);  /* #f5f5f5 */
  border: 1px solid var(--cx-border);
  border-radius: var(--cx-radius-md);
  padding: 20px;
  font-size: var(--cx-text-base);
  line-height: var(--cx-leading-normal);
  color: var(--cx-text-secondary);
}
.cx-ai-answer__card p { margin: 0 0 12px; }
.cx-ai-answer__card p:last-child { margin-bottom: 0; }
.cx-ai-answer__card strong { color: var(--cx-text); font-weight: 600; }

.cx-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--cx-border);
}
.cx-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--cx-bg);
  border: 1px solid var(--cx-border);
  border-radius: var(--cx-radius-full);
  font-size: var(--cx-text-xs);
  color: var(--cx-text-secondary);
  text-decoration: none;
  transition: background .15s;
}
.cx-source-chip:hover { background: var(--cx-hover); }
```

### 4.5 Product Result (Cellex — replaces Google's text result)

Google's text result = favicon+URL → title link → snippet.
Cellex's product result = thumbnail + seller/brand → title → price + meta.

```
┌──────────────────────────────────────┐
│ [img]  Seller Name · Category        │  ← gray meta line (like URL breadcrumb)
│ [img]                                 │
│ [img]  Product Title Goes Here        │  ← black, 18px, semibold
│ [img]  Short description snippet...   │  ← gray, 14px
│        $49.99  ★ 4.8 (234)  · Ships   │  ← price bold + meta gray
└──────────────────────────────────────┘
```

**Mobile**: thumbnail 56–72px square on the left, text on the right, full width.
**Desktop**: same horizontal layout, content column max 692px.

```css
.cx-result {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--cx-border);  /* subtle dividers */
}
/* Optional: remove border, use spacing like Google (Google uses ~22px gaps) */
.cx-result:last-child { border-bottom: none; }

.cx-result__thumb {
  width: 72px;
  height: 72px;
  border-radius: var(--cx-radius-sm);
  object-fit: cover;
  background: var(--cx-surface-muted);
  flex-shrink: 0;
}
.cx-result__body { flex: 1; min-width: 0; }
.cx-result__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--cx-text-sm);
  color: var(--cx-text-muted);
  margin-bottom: 4px;
}
.cx-result__title {
  font-size: var(--cx-text-lg);    /* 18px mobile, 20px desktop */
  font-weight: var(--cx-fw-medium);
  color: var(--cx-text);           /* black (Google's would be blue) */
  line-height: var(--cx-leading-tight);
  margin: 0 0 4px;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cx-result__title:hover { text-decoration: underline; }
.cx-result__snippet {
  font-size: var(--cx-text-base);
  color: var(--cx-text-secondary);
  line-height: var(--cx-leading-normal);
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cx-result__price {
  font-size: var(--cx-text-base);
  font-weight: var(--cx-fw-semibold);
  color: var(--cx-text);
  margin-right: 8px;
}
.cx-result__rating {
  font-size: var(--cx-text-sm);
  color: var(--cx-text-muted);
}
```

### 4.6 Video Result (Cellex — for Videos tab)

Google's video result: thumbnail (16:9) → title link → channel + upload date.
Cellex version: 16:9 thumbnail, black title, gray seller + view count.

```css
.cx-video-result {
  padding: 16px 0;
  border-bottom: 1px solid var(--cx-border);
}
.cx-video-result__thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--cx-radius-md);
  object-fit: cover;
  background: var(--cx-surface-muted);
  margin-bottom: 8px;
}
.cx-video-result__title {
  font-size: var(--cx-text-lg);
  font-weight: var(--cx-fw-medium);
  color: var(--cx-text);
  line-height: var(--cx-leading-tight);
  margin: 0 0 4px;
}
.cx-video-result__meta {
  font-size: var(--cx-text-sm);
  color: var(--cx-text-muted);
}
```

### 4.7 Filters / Tools Row (optional, below tabs)

Google has a "Tools" row with time filters, etc. Cellex can mirror this for the Products tab: Sort, Price, Condition, Shipping.

```css
.cx-filters {
  display: flex;
  gap: 8px;
  padding: 12px var(--cx-content-pad);
  max-width: 692px;
  margin: 0 auto;
  overflow-x: auto;
  scrollbar-width: none;
}
.cx-filters::-webkit-scrollbar { display: none; }
.cx-filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--cx-surface);
  border: 1px solid var(--cx-border);
  border-radius: var(--cx-radius-full);
  font-size: var(--cx-text-sm);
  color: var(--cx-text-secondary);
  white-space: nowrap;
  cursor: pointer;
}
.cx-filter:hover { background: var(--cx-hover); }
.cx-filter--active {
  background: var(--cx-text);      /* black pill */
  color: var(--cx-inverse);        /* white text */
  border-color: var(--cx-text);
}
```

### 4.8 Pagination

Google uses the `< 1 2 3 4 5 >` pattern with the active page in black text, prev/next as arrows.

```css
.cx-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 32px 0;
}
.cx-pagination__num {
  padding: 8px 12px;
  font-size: var(--cx-text-sm);
  color: var(--cx-text-secondary);
  cursor: pointer;
  border-radius: var(--cx-radius-full);
}
.cx-pagination__num:hover { background: var(--cx-hover); }
.cx-pagination__num--active { color: var(--cx-text); font-weight: 600; }
.cx-pagination__nav { padding: 8px 12px; color: var(--cx-text-muted); cursor: pointer; }
.cx-pagination__nav:hover { color: var(--cx-text); }
```

---

## 5. Responsive Behavior

**Mobile-first** (default styles above). Desktop enhancements:

```css
@media (min-width: 768px) {
  :root {
    --cx-text-lg: 20px;       /* larger titles on desktop */
    --cx-content-pad: var(--cx-content-pad-d);
  }
  .cx-header__inner,
  .cx-tabs__inner,
  .cx-results,
  .cx-filters {
    max-width: 692px;
    margin-left: auto;
    margin-right: auto;
  }
  .cx-result__thumb { width: 92px; height: 92px; }
  .cx-tab { padding: 16px 16px; font-size: var(--cx-text-base); }
  .cx-ai-answer__card { padding: 24px; }
}

@media (min-width: 1100px) {
  /* Optional: two-column layout like Google's Knowledge Panel.
     Left = results (692px), right = entity/product detail panel. */
  .cx-layout {
    display: grid;
    grid-template-columns: 692px 1fr;
    gap: 40px;
    max-width: 1100px;
    margin: 0 auto;
  }
}
```

---

## 6. Overall Page Structure (HTML skeleton)

```html
<body>
  <!-- Sticky header -->
  <header class="cx-header">
    <div class="cx-header__inner">
      <a href="/" class="cx-logo">Cellex</a>
      <form class="cx-searchbar" role="search">
        <svg class="cx-searchbar__icon">...</svg>
        <input type="text" value="wireless earbuds" aria-label="Search" />
        <button class="cx-searchbar__clear" aria-label="Clear">×</button>
      </form>
    </div>
  </header>

  <!-- Sticky tabs -->
  <nav class="cx-tabs">
    <div class="cx-tabs__inner">
      <button class="cx-tab cx-tab--active">AI Answer</button>
      <button class="cx-tab">Products</button>
      <button class="cx-tab">Videos</button>
    </div>
  </nav>

  <!-- Optional filter row (Products tab only) -->
  <div class="cx-filters">
    <button class="cx-filter cx-filter--active">All</button>
    <button class="cx-filter">Under $50</button>
    <button class="cx-filter">Free shipping</button>
    <button class="cx-filter">Top rated</button>
  </div>

  <!-- Results column -->
  <main class="cx-results" style="max-width:692px;margin:0 auto;padding:0 16px;">
    <!-- AI Answer (top of AI Answer tab) -->
    <section class="cx-ai-answer">
      <div class="cx-ai-answer__label">AI Answer</div>
      <div class="cx-ai-answer__card">
        <p>Here's a quick summary of <strong>wireless earbuds</strong> on Cellex…</p>
        <p>Top picks balance battery life, sound quality, and price…</p>
        <div class="cx-sources">
          <a class="cx-source-chip" href="#">Seller A</a>
          <a class="cx-source-chip" href="#">Seller B</a>
        </div>
      </div>
    </section>

    <!-- Product results -->
    <article class="cx-result">
      <img class="cx-result__thumb" src="..." alt="" />
      <div class="cx-result__body">
        <div class="cx-result__meta">SoundWave · Electronics</div>
        <a href="/product/1" class="cx-result__title">Wireless Earbuds Pro — Active Noise Cancelling</a>
        <p class="cx-result__snippet">Bluetooth 5.3, 30h battery, USB-C. Best-selling earbuds from a trusted Cellex seller.</p>
        <span class="cx-result__price">$49.99</span>
        <span class="cx-result__rating">★ 4.8 (234) · Free shipping</span>
      </div>
    </article>
    <!-- repeat results... -->
  </main>

  <nav class="cx-pagination">
    <span class="cx-pagination__nav">‹ Previous</span>
    <span class="cx-pagination__num cx-pagination__num--active">1</span>
    <span class="cx-pagination__num">2</span>
    <span class="cx-pagination__num">3</span>
    <span class="cx-pagination__nav">Next ›</span>
  </nav>
</body>
```

---

## 7. Visual Hierarchy Summary

From most → least prominent:

1. **Search bar** (sticky, prominent, full width on mobile) — primary action affordance.
2. **Active tab** (black text + black underline) — tells user what content type they're viewing.
3. **AI Answer card** (top of results, gray fill, black accent bar, larger heading) — the "answer first" treatment Google pioneered.
4. **Product result titles** (18–20px, semibold, black, 2-line clamp) — primary clickable targets.
5. **Product thumbnails** (72–92px) — visual anchors.
6. **Prices** (semibold black) — key e-commerce signal.
7. **Snippets/descriptions** (14px gray) — secondary info.
8. **Meta lines** (seller, category, rating, URL-equivalent — 13px muted gray) — like Google's breadcrumb row.

---

## 8. Key Design Principles (from Google's approach)

1. **Content over chrome** — minimal borders, lots of whitespace, results are the hero.
2. **Left-aligned narrow column** (~692px) — easy scanning, consistent rhythm.
3. **Sticky header + tabs** — search and navigation always reachable.
4. **System fonts** — fast, native, no web font load (Arial/Roboto stack).
5. **Subtle interactions** — gentle shadow on focus, color shifts on hover, no heavy animations.
6. **Answer-first** — AI summary at top when available, organic results below.
7. **Generous touch targets** — 44px+ heights, 8px+ gaps (Google's mobile guidelines).
8. **Mobile-first** — single column, horizontal-scroll tabs/filters, then expand to fixed max-width on desktop.

---

## 9. Differences from Google (Cellex-specific)

| Aspect | Google | Cellex |
|---|---|---|
| Link color | Blue `#1a0dab` | Black `#171717` (underline on hover) |
| Visited color | Purple `#681da8` | Dark gray `#525252` |
| Logo | Multi-color | Black wordmark "Cellex" |
| AI accent | Blue→purple gradient | Black left accent bar + gray fill |
| Tabs | All/Images/Videos/News/Shopping/Maps | **AI Answer / Products / Videos** |
| Result type | Web page (title+URL+snippet) | Product (title+seller+price+rating) |
| Right panel | Knowledge Graph | Optional product detail panel on desktop |
| Ads | Labeled "Sponsored" at top | (Future) "Sponsored" product slots, B&W |

---

## 10. Next Actions for Implementation

1. **Create the search page UI** at `src/app/search/page.tsx` using the above spec.
   - Existing file exists — refactor to this layout.
2. **Add design tokens** to `src/app/globals.css` (the `:root` variables in §3.1–3.3).
3. **Build components**:
   - `SearchHeader` (sticky logo + search bar)
   - `SearchTabs` (AI Answer / Products / Videos)
   - `AIAnswerCard`
   - `ProductResultCard`
   - `VideoResultCard`
   - `FilterRow` (Products tab)
   - `Pagination`
4. **Wire to existing API**: `/api/smart-search` and `/api/products` already exist.
5. **Mobile QA**: verify 44px touch targets, horizontal scroll for tabs/filters, sticky offsets.
6. **Desktop QA**: verify 692px content column, optional right panel at ≥1100px.

---

### Sources
- Google Search Central — [Visual Elements Gallery](https://developers.google.com/search/docs/appearance/visual-elements-gallery)
- Google Blog — [Generative AI in Search (May 2024)](https://blog.google/products-and-platforms/products/search/generative-ai-google-search-may-2024)
- The Verge — [Google is redesigning its search engine](https://www.theverge.com/2024/5/14/24155321/google-search-ai-results-page-gemini-overview)
- Wikipedia — [AI Overviews](https://en.wikipedia.org/wiki/AI_Overviews) (occupies ~67% desktop / ~75% mobile viewport)
- GoodUI — [Google link color A/B test leak](https://goodui.org/leaks/google-has-been-a-b-testing-link-colors-again-and-this-light-blue-didnt-pass) (confirms `#1A0DAB` blue, rejected lighter variants)
- Screaming Frog — [SERP snippet pixel width](https://www.screamingfrog.co.uk/blog/an-update-on-pixel-width-in-google-serp-snippets) (18px Arial titles)
- SERoundtable — [Google testing rounded snippet design](https://www.seroundtable.com/google-rounded-search-results-snippet-design-40021.html)

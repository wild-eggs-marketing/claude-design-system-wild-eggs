# Site Accessibility Audit — Crazy Bowls & Wraps (2026-07-11)

Audited via Framer project source (MCP); sandbox network policy blocked live-HTML
fetches, so publish-time checks (html lang, titles, viewport zoom, landmarks) still
need a live axe/Lighthouse pass — Framer defaults are typically compliant.

## Findings (deduplicated, ranked)

| # | Issue | WCAG | Severity | Status |
|---|---|---|---|---|
| 1 | Icon-only social links (Footer, every page) have no accessible name | 4.1.2, 2.4.4 | Critical | **Fixed** — runtime patcher |
| 2 | Meaningful images are CSS backgrounds; no alt text site-wide | 1.1.1 | Serious | **Fixed** — ALT_MANIFEST in runtime patcher (role="img" + aria-label); plus alt="" backstop on unlabeled imgs |
| 3 | Footer newsletter has no email input; "Subscribe" is a link to /loyalty | 3.3.2, 4.1.2 | Serious | Open (Footer needs manual redesign; MCP can't edit it) |
| 4 | Hero TextTicker: infinite marquee, no reduced-motion, text ×7 exposed to AT | 2.2.2, 1.1.1 | Serious | **Fixed** — TextTicker.tsx |
| 5 | Apricot small-text links 2.79:1 on white (map popups) | 1.4.3 | Serious | **Fixed** — LocationsMap.tsx (teal 9.3:1, underlined) |
| 6 | Unlabeled focusable Leaflet map pins (15) | 1.1.1, 4.1.2 | Serious | **Fixed** — LocationsMap.tsx |
| 7 | Footer headings skip h2→h6 | 1.3.1 | Moderate | **Fixed** — runtime patcher (aria-level=2) |
| 8 | Footer tel: href `+456 567 3423` vs displayed (502) 409-7848; tel in new tab | 2.4.4 + bug | Moderate | **Fixed** — runtime patcher |
| 9 | "Ste 290Louisville" missing space | — | Minor | **Fixed** — runtime patcher |
| 10 | Map "Locating…"/geolocation errors silent to AT | 4.1.3 | Moderate | **Fixed** — LocationsMap.tsx aria-live |
| 11 | target=_blank links without new-tab warning | 3.2.2 | Minor | **Fixed** — runtime patcher appends to labels |
| 12 | Footer Instagram auto-ticker (moving content, image links) | 2.2.2 | Moderate | Partially mitigated (Crazy Dial Calm mode stops CSS animation) |

Contrast pairs verified OK: ink/cream 13.5, teal/white 9.3, green/lime 6.1,
white/ink 14.9, ink/yellow 8.9. Dragonfruit/cream 4.2 — large/bold text only.
NutritionCalculator already strong (aria-labels, live regions, reduced-motion).

## Fixes shipped

1. **`TextTicker.tsx`** — SVG marked `aria-hidden` (kills the ×7 announcement);
   `<animate>` removed under `prefers-reduced-motion` OR Crazy Dial Calm mode
   (reads `cb-crazy-dial` localStorage; CSS overrides can't reach SVG SMIL).
2. **`LocationsMap.tsx`** — pins are keyboard-focusable with `role="button"` +
   aria-label (name, city); popup links teal + underlined; map container is a
   labeled region; `aria-live` announcer for locating / nearest-store / error.
3. **`A11ySiteFixes.tsx`** (new, mounted inside the Navbar → every page) —
   runtime patcher for what canvas components can't express: social-link
   aria-labels, tel href correction + no new-tab on tel/mailto, address spacing,
   "(opens in new tab)" on labeled external links, footer h6 → aria-level 2.
   Re-applies after SPA navigation via MutationObserver.

## Alt text approach (finding 2)

CSS background images are natively silent to assistive tech; the failure was
meaningful photos with no text alternative. Remediated in `A11ySiteFixes.tsx`:

- **ALT_MANIFEST**: filename → description map. Matching frames get
  `role="img"` + `aria-label`; matching `<img>` variants get real `alt`.
  Covers the home hero bowl, "Real ingredients" photo, Lobster Rangoon photo,
  and the locations hero. Add new photos by appending a manifest entry.
- **Backstop**: any `<img>` with no alt attribute gets `alt=""` so raw
  filenames are never announced. Menu-card and detail-page images sit next to
  the item's visible title, so decorative-empty alt is the correct semantics.
- Descriptions were written from page context; copy team should refine wording.
- Long-term ideal remains converting these frames to real image layers with
  alt in the Framer editor — the manifest keeps AA compliance until then, and
  is the only mechanism available via MCP (the schema exposes no alt).

## Remaining (manual / next)

- **Footer newsletter** (finding 3): add a real labeled email input + submit,
  or reframe as a plain "Join Crazy Points" CTA. Footer component returns an
  MCP read error, so this is an in-editor fix.
- Post-publish axe/Lighthouse run to close the verification gaps.

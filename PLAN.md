# PLAN.md — Crazy Bowls & Wraps: Reinvented Location Picker

**Status:** LOCKED (grilled 2026-07-11)
**Owner:** elle@wildeggs.com
**Build surface:** Framer project "Crazy Bowls V1" (code components via MCP)

---

## Goal

Turn the "find a location" moment into the first bite of the brand: a picker that
**answers before it asks**, remembers your store without a login, and looks
unmistakably Crazy Bowls — beating Chipotle's national-directory UX by leaning
into what a 15-store regional operator can do that a 3,700-store chain can't.

## Success criteria (strict — every one must clear before "done")

1. **Answers first:** on open, a returning/geolocated visitor sees their closest
   OPEN store with live hours + distance + one-tap Order, before any typing.
2. **Brand-consistent:** double-ring buttons, Passion One / Bricolage type,
   teal/cream/lime/apricot, doodle pins. Passes an Impeccable/Design-Taste pass
   (no generic radii, no AI tells).
3. **Accessible:** AA contrast, keyboard-operable, focus-visible rings, respects
   `prefers-reduced-motion`, geolocation never auto-prompts.
4. **Responsive:** works from 320px to desktop via ResizeObserver container
   queries (not viewport media), no horizontal overflow.
5. **Routing-correct:** every store link navigates to `/locations/{slug}` on the
   PUBLISHED site (navTo interception fix applied everywhere).
6. **Verified live:** the closest-store answer, the ZIP search, and a card click
   are each exercised on the published site, not just typecheck-green.

## Approach

One shared picker with two render modes, not three new page builds.

- **`LocationPicker.tsx`** (new) — the core. Props switch `mode="inline"`
  (homepage section) vs `mode="overlay"` (full-screen modal). Internally reuses
  the store dataset + open/closed + Haversine logic we already have.
  - Left rail: intent/amenity chips → smart answer card (nearest open store) →
    ZIP/city search box → region-grouped results list.
  - Right: branded Leaflet map (CARTO tiles + doodle pins + connector), card↔pin
    hover sync.
- **Nav launcher** — add "Find a location 📍" to the Navbar (`UKoWnW7Zm`) opening
  the picker in overlay mode. Implemented as a small code component or an XML
  link that toggles the overlay.
- **Homepage section** — `LocationPicker mode="inline"` placed high on `/`.
- Keep `NearestStoreHero`, `LocationsGrid`, `LocationsMap` as-is for the
  `/locations` page; the picker consolidates their logic into the shared module
  so we stop duplicating store data. (Follow-up: extract a single `stores.ts`
  data module all four import — tracked in Out of Scope for v1.)

## Key decisions (from grill)

| Decision | Locked answer |
|---|---|
| Surface | Homepage inline section **+** nav "Find a location" overlay launcher |
| Search | Geolocation **+** City/State/ZIP box, geocoded via free OSM **Nominatim** (no API key) |
| Memory | localStorage only: **last store + last geo**, quick-return on revisit. No account, no order history |
| Map style | **CARTO light tiles + custom carrot/bowl doodle pins**, teal/cream connector, branded popups. No paid tile provider |
| Personalization stance | Anonymous, no login, no server persistence, never auto-prompt geolocation, always a neutral zero-signal default, visible reset |
| Time logic | Central time (America/Chicago) via Intl; open/closed + "breakfast till 10:30" + "closest is closed, X open till 9" copy |

## Build phases

**Phase 0 — Clean the runway (pre-req, verify-gated)**
- Confirm `/locations/{slug}` routing fix works on the PUBLISHED site.
- Delete empty duplicate code files (`LocationsGrid.tsx` `au75cLN`,
  `LocationsListSchema.tsx` `KgDIOz0`).
- Place `NearestStoreHero` on the homepage (or fold into picker inline mode).

**Phase 1 — Core "answers first" (ships alone)**
- `LocationPicker.tsx` inline mode: smart answer card + geolocation + region list.
- localStorage last-store/last-geo quick-return.
- Brand double-ring CTAs, live open/closed, distance.

**Phase 2 — Search + map**
- Nominatim ZIP/city geocode box (debounced, graceful failure, attribution).
- Branded Leaflet map panel with doodle pins + card↔pin hover sync + connector.

**Phase 3 — Overlay + nav launcher**
- `mode="overlay"` modal (focus trap, ESC/X close, non-destructive dismiss).
- Nav "Find a location 📍" entry point wired to open it.

**Phase 4 — Delight layer**
- Time/context-aware copy (breakfast window, drive-thru at dinner, closed-nearby
  fallback).
- Amenity-first chips (Drive-thru / Patio / Breakfast / Catering) re-sort map+list.

## Risks & mitigations (pre-mortem / /scout)

- **Nominatim rate limits / downtime** → debounce, cache results in-session, fall
  back to browse + geolocation, show a friendly "search unavailable" note. Never
  block the page on it.
- **Framer SPA router swallows internal links** → apply the `navTo()` +
  `window.location.assign` pattern to every internal link (already standardized).
- **Component sprawl / duplicate store data** → single source of truth is the
  v1-acceptable duplication; schedule the `stores.ts` extraction as fast-follow so
  data doesn't drift across 4 files.
- **Overlay a11y** → focus trap, restore focus on close, `aria-modal`, ESC, body
  scroll-lock. Test with keyboard only.
- **Geolocation privacy perception** → labeled tap-target only, copy explains why,
  coords stay in localStorage, visible "Not you? / Reset."
- **Map perf on mobile** → lazy-load Leaflet only when the map panel is visible
  (overlay opened / section scrolled into view), single init, invalidateSize.
- **Shipping without verifying** (our repeated failure) → each phase has a proof
  test that must pass on the published site before the phase is "done."

## Proof tests (the verifier gate)

- P1: With geo granted, open homepage → closest open store card renders correct
  name + live status + working Order link. Deny geo → clean neutral default, no
  prompt loop.
- P2: Type a known ZIP (e.g. 63130) → list + map re-center to nearest stores;
  type gibberish → graceful "no match," page still usable.
- P3: Click a store name/card on the PUBLISHED site → lands on
  `/locations/{slug}` detail page. Cmd-click opens a new tab.
- P4: Keyboard-only: tab to nav launcher → open overlay → operate chips/search →
  ESC closes and returns focus. Screen-reader announces modal.
- P5: 320px width: no horizontal scroll; buttons/chips wrap; map ≥ 360px tall.

## Out of scope (v1)

- Login / accounts / server-side profiles / order history.
- Paid map tiles (Mapbox/Maptiler) — revisit only if custom tiles are greenlit.
- Delivery routing / third-party delivery integration.
- Multi-language.
- The shared `stores.ts` refactor (fast-follow, not blocking v1).
- Google Places autocomplete.

## Definition of done

All 6 success criteria clear, all 5 proof tests pass on the published site, an
Impeccable/Design-Taste audit finds no AI tells, and a `/brief` handoff lists
what shipped + what's queued.

# Wild Eggs — AEO/SEO Audit & Phased Optimization Plan

**Date:** July 6, 2026
**Scope:** wildeggs.com AI-search (AEO) and organic-search presence vs. First Watch, Snooze A.M. Eatery, and Another Broken Egg
**Method:** Windsor.ai connector inventory, search-index competitive research (WebSearch), and 2026 industry AEO research. Confidence scores (1–5) mark how solid each finding/recommendation is.

---

## 1. Audit constraints (read first)

Two things blocked deeper verification in this session and should be fixed before Phase 1 begins:

1. **Sandbox egress policy** blocked direct fetches of wildeggs.com, firstwatch.com, snoozeeatery.com, and archive.org (proxy returned `connect_rejected: policy denial`). All robots.txt, JSON-LD, and llms.txt claims below are therefore **unverified inferences from search-index data**, flagged as such. Re-run the technical crawl from an open-egress environment or paste saved HTML/robots.txt/sitemap files for offline audit.
2. **Windsor.ai Free plan limit** — the account has more connectors/accounts connected than the Free plan allows, so Search Console and GA4 data pulls returned no usable rows. Upgrade or trim accounts, then re-pull: GSC queries (branded vs. non-branded, CTR, position) and GA4 channel/landing-page data are the measurement backbone of this plan.

**Connected and ready in Windsor once unblocked:** GA4 (`www.wildeggs.com`, Franchising, Crazy Bowls), Search Console (`wildeggs.com`, `crazybowlsandwraps.com`), Instagram (with `create_image_post` write action), Facebook Organic, Instagram public (competitor handles incl. `crazybowlsandwraps`).

---

## 2. What we verified about the competitive landscape

### First Watch (firstwatch.com) — confidence 4/5 (search-index verified)
- Per-location pages with query-language titles ("Best Breakfast at First Watch Wake Forest, NC") — `firstwatch.com/locations/{slug}`.
- **Per-menu-item landing pages** (e.g. `/menu/million-dollar-breakfast-sandwich`) — the standout tactic; each dish is an indexable, AI-quotable entity.
- Dedicated nutrition & allergen page (`/nutrition-and-allergens`) — captures dietary AI queries.
- Olo-powered ordering + waitlist subdomain, mobile app, creator/UGC program, newsroom.
- No consumer blog or FAQ pages surfaced.

### Snooze A.M. Eatery (snoozeeatery.com) — confidence 4/5
- Three-tier location architecture: hub → **state hub pages** (`/restaurant/california`) → location pages. State hubs capture "brunch in {state/metro}" queries.
- Homepage title is pure query language: "Best Breakfast & Boozy Brunch Near You."
- Separate ordering subdomain. No blog/FAQ surfaced.

### Another Broken Egg (anotherbrokenegg.com) — confidence 4/5
- Aggressively templated location titles ("Best Brunch in Burbank CA") with **landmark-anchored copy** ("in the Portofino Shopping Center off I-45 North") — exactly the text AI engines quote for "near X" queries.

### Wild Eggs baseline — confidence 3/5 (search-index only)
- Already has per-location pages with "Best Brunch Restaurant" titles (e.g. `/palomar-ky/`), menus, catering, `/online-ordering`, `/reservations`. Hours/phone/address are indexed. Roughly at parity with ABE on location-page basics; behind First Watch on menu-item entities and nutrition content.

### Key industry data point — confidence 5/5 (published research)
Uberall (May 2026): **83% of restaurant locations never appear in AI answers; AI-recommended restaurants average 3,424 Google reviews vs. 955 for non-recommended (3.6×)**. Review volume/velocity is the single strongest AI-visibility signal. (businesswire.com/news/home/20260507962493/en/)

---

## 3. The biggest AEO gaps (ranked by expected impact)

| # | Gap | Impact | Confidence |
|---|-----|--------|------------|
| 1 | Per-location review velocity program (the #1 AI-visibility signal) | Very high | 5/5 |
| 2 | Per-location `Restaurant` JSON-LD (hours, geo, servesCuisine, menu, aggregateRating) linked to a sitewide `Organization` — presence unverified, assume missing/incomplete | Very high | 3/5 |
| 3 | No FAQ content / FAQPage schema (none of the competitors have it either — open ground) | High | 4/5 |
| 4 | No per-menu-item pages (First Watch's differentiator; signature dishes like the Kelsey KY Brown are unclaimed entities) | High | 4/5 |
| 5 | No nutrition/allergen/dietary content (First Watch has it; dietary queries are a top AI use case) | High | 4/5 |
| 6 | No state/metro hub pages (Snooze's tactic; Wild Eggs spans KY/IN/OH+) | Medium-high | 4/5 |
| 7 | Thin, templated location-page body copy vs. ABE's landmark-anchored descriptions | Medium | 3/5 |
| 8 | AI-crawler access unverified: robots.txt may block GPTBot/ClaudeBot/PerplexityBot; no llms.txt (near-zero adoption industry-wide = first-mover opportunity) | Medium | 2/5 (unverified) |
| 9 | No blog/content layer ("Best brunch in Louisville" guides) — no competitor has one | Medium | 4/5 |
| 10 | Measurement gap: Windsor plan limit means no query/CTR/position baseline exists today | Foundational | 5/5 |

---

## 4. Phased optimization plan

### Phase 0 — Unblock & baseline (Week 1) · confidence 5/5
- Fix Windsor.ai plan/account limit; pull 12-month GSC baseline (branded vs. non-branded, top queries, CTR by page) and GA4 channel mix.
- Run the full technical crawl from an open environment: robots.txt AI-crawler rules, JSON-LD inventory, sitemap, rendering (server-rendered vs. JS-hydrated), Core Web Vitals via Google PageSpeed (also a Windsor connector).
- Establish an AI-answer tracking baseline: monthly scripted queries to ChatGPT/Perplexity/Gemini ("best breakfast in Louisville", "brunch near me {each market}") logging whether Wild Eggs is mentioned/cited.
- **Why:** you can't 10x what you can't measure; every later phase needs this baseline.

### Phase 1 — Technical AEO foundation (Weeks 2–4) · confidence 4/5
- Ensure robots.txt explicitly **allows** GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot; add `llms.txt` (brand summary, locations, menu highlights, FAQs) — likely first mover in the category.
- Ship per-location `Restaurant` JSON-LD: `openingHoursSpecification`, `geo`, `servesCuisine` ("breakfast", "brunch", "American"), `priceRange`, `menu`, `acceptsReservations`, `aggregateRating`, linked via `@id`/`parentOrganization` to one sitewide `Organization`. (Sources: malou.io, gatilab.com, schema.org/Restaurant)
- Make the full menu crawlable HTML (no PDF/image-only), with `Menu`/`MenuSection`/`MenuItem` schema.
- Sync hours/menu/ordering links between site schema and every Google Business Profile; validate continuously.

### Phase 2 — Answer-content layer (Weeks 4–10) · confidence 4/5
- **FAQ program:** 15–25 questions per the brand + per-location variants ("Is there a wait on weekends at Wild Eggs {location}?", "Does Wild Eggs have gluten-free pancakes?") with FAQPage schema. No competitor does this — cheapest way to *beat* rather than copy.
- **Per-menu-item pages** for 15–25 signature dishes (Kelsey KY Brown, Everything Muffin, etc.): photo, description, ingredients, dietary flags, MenuItem schema. Copies First Watch's best tactic.
- **Nutrition/allergen/dietary hub** (gluten-free, vegetarian, keto-friendly options).
- **State/metro hub pages** (`/locations/kentucky/`, Louisville, Lexington, Indianapolis, Cincinnati) copying Snooze's architecture.
- Rewrite location body copy with landmarks/neighborhoods/highways (ABE pattern) — unique per location, not templated.

### Phase 3 — Review velocity & entity building (Weeks 6–16, ongoing) · confidence 5/5 on rationale
- Per-location review generation: post-visit prompts via receipt QR / ordering-flow email; manager response SLA on all reviews. Target: top review velocity in each local market (winnable at ~40 locations in a 3-state footprint even if First Watch wins nationally).
- NAP consistency sweep: GBP, Yelp, Apple Maps, TripAdvisor, DoorDash/Grubhub listings — AI assistants build a composite entity from all of these (malou.io, birdeye.com).
- Local press/listicle outreach ("best brunch in Louisville" placements) — Perplexity and ChatGPT cite these pages directly.

### Phase 4 — AI-leveraged content engine (Weeks 8+, ongoing) · confidence 3/5
- Stand up the 4-step AI content workflow from your prompt library (spy → hooks → script → carousel) for Instagram/Facebook, publishing via the already-connected Windsor Instagram `create_image_post` action; measure with GA4/GSC deltas.
- City brunch-guide blog content (own "best brunch in {market}" — no competitor publishes this).
- Monthly AI-answer share-of-voice report (from Phase 0 tracking) reviewed against GSC non-branded click growth.

### Phase 5 — Measure, iterate, expand (Quarterly) · confidence 4/5
- KPI set: AI-answer mention rate per market, non-branded GSC clicks, location-page CTR, review count/velocity per location, GBP actions.
- Expand the playbook to Crazy Bowls & Wraps (already connected in Windsor and the Framer project in this workspace) once Wild Eggs numbers validate.

---

## 5. Sources

- Uberall AI restaurant visibility report, May 2026 — businesswire.com/news/home/20260507962493/en/
- Restaurant schema guides — malou.io/en-us/blog/structured-data-for-restaurants; gatilab.com/local-business-schema-markup/; richmenu.io/restaurant-schema-markup/; thedigitalrestaurant.com/restaurant-schema-markup-guide/; schema.org/Restaurant
- AI-engine behavior — skyscale.com.au/blogs/get-restaurant-featured-in-chatgpt-ai-answers; almcorp.com/blog/answer-engine-optimization-2026/; birdeye.com/blog/ai-search-recommendations-for-restaurants/; malou.io/en-us/blog/restaurants-ai-chatgpt
- Restaurant SEO practice — chowly.com (restaurant SEO guide 2026); hurrdatmarketing.com/seo-news/seo-for-restaurants/; merchants.doordash.com/en-us/blog/restaurant-seo
- Competitor evidence — firstwatch.com/locations, /menu/million-dollar-breakfast-sandwich, /nutrition-and-allergens; olo.com/case-studies/first-watch; snoozeeatery.com/restaurants and /restaurant/{state}; anotherbrokenegg.com/locations/; restaurantbusinessonline.com (First Watch marketing plan)
- First-party — Windsor.ai connector inventory for this account (GA4, GSC, Instagram, Facebook Organic)

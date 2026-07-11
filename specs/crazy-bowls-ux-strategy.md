# Crazy Bowls & Wraps — UX Strategy & Innovation Spec

**Status:** Approved direction, pending build order sign-off
**Owner:** Brand/AI Engineering (Elle)
**Date:** 2026-07-11
**Scope:** crazybowlsandwraps.framer.website (Framer project "Crazy Bowls_V1") + brand/marketing stack

---

## 1. Ground truth (verified live via Framer MCP, 2026-07-11)

Corrections to the original audit brief — build against these, not the brief:

1. **Loyalty is NOT a stub.** Crazy Points is live (RewardsHero/Steps/Perks/Banner components) wired to `myguestaccount.com` (third-party, no API access from Framer).
2. **Locations system exists.** LocationsMap, NearestStoreHero, OpenNowBadge, AmenityChips, per-location pages + schema.
3. **Ordering is off-site.** Delivery → `order.online`; pickup → `orderexperience.net`. The site cannot own a cart. Its job: **Discovery → Delight → Decision → hand-off with intent.**
4. **Assets already available:** NutritionCalculator component (per-item data), playful palette (Teal/Dragonfruit/Lime/Warm Apricot), Passion One + Bricolage Grotesque type system, proven motion (TextTicker "Everyone's crazy about something").
5. **Footprint:** ~6–8 stores, all St. Louis metro. Any location-based mechanic must work at this density.

**Core insight:** the brand *voice* is already crazy ("Lobster Rangoon on a health menu? We're not sorry."). The *interaction design* isn't. Close that gap; don't chase competitor feature parity.

## 2. Operating stack (standing, every task)

- **Thinking:** Advisory Panel (Challenger / Root-Cause / Opportunity / Fresh Eyes / Action Coach) → single synthesis; /steelman + /devil + Failure Simulation before committing; /scout pre-ship; /brief to close.
- **Design:** this repo's skills — discovery-questions, wireframe, generate-variations, ai-slop-check, accessibility-audit, hierarchy-rhythm-review, interaction-states-pass, polish-pass.
- **Build:** Framer MCP (live), Grill→Review→Verdict→Build loop for features, self-checking loop (8/10 bar) for deliverables.
- **Assets:** Higgsfield MCP (image / video / **generate_3d → GLB** / audio), HyperFrames/Remotion for video.
- **Marketing ops:** Windsor.ai MCP (read+write Meta/Google/TikTok) + Claude Ads 190-check audits.
- **Writing:** /10x → /ghost; brand voice guide.

## 3. Web/UX roadmap (ratified 2026-07-11)

### Phase 1 — trust, nearly free
- **Nutrition + allergen chips on every menu card** (V/GF/DF/nut + calories). Data exists in NutritionCalculator. Confidence 0.9.

### Phase 2 — the on-brand leapfrog
- **Bowl Matchmaker quiz** (3–4 taps: spice / vibe / goal → named bowl + shareable card → order hand-off). Whitespace vs. all competitors; no backend. Confidence 0.85.
- **Delight layer + a11y mode** (signature micro-interactions, playful empty/success states, reduced-motion + a11y toggle). Confidence 0.8.

### Phase 3 — bigger bets
- **Bowl Builder** — reframed: NOT a cart. Configurator → order hand-off + shareable build card. Confidence 0.75.
- **Good ↔ Crazy Map** (ownable 2-axis rating IP: light→indulgent × mild→unhinged, plotted from nutrition data). Confidence 0.72.
- **Bowl Bracket** (seasonal fan-voted tournament → "People's Champion" LTO). Confidence 0.68.

### Parallel (non-web)
- **Ad Intelligence Loop:** Windsor.ai + Claude Ads recurring audit + weekly creative brief. Confidence 0.7.

### Deprioritized
- Loyalty gamification (program live; provider API unreachable from Framer), location-first entry (already exists), group ordering (owned by Olo-side platforms).

## 4. AR track — devil's advocate review + rerank (researched 2026-07-11)

### Landscape facts that changed the math
- **8th Wall hosted platform retired 2026-02-28** (open-sourced; self-host only; published experiences die 2027-02-28). The brief's default WebAR stack no longer exists as a service.
- **Meta Spark shut down 2025-01-14** — no more brand filters on Instagram/Facebook. IG as an AR distribution surface is dead.
- **Snap Lens Studio AI / Easy Lens:** text-prompt → working AR lens (GenAI suite, video-to-3D reconstruction coming). Branded lens effort collapsed from M to S.
- **Image-to-3D is now minutes, not weeks:** Higgsfield `generate_3d` (in our MCP) produces GLB from a photo; `<model-viewer>` gives free web AR (Android Scene Viewer / iOS Quick Look) with zero AR SDK.
- **MindAR:** free MIT image/face-tracking WebAR, actively maintained — replaces paid marker AR.

### Verdicts

| Idea | Verdict | Devil's advocate summary | Conf. (was) |
|---|---|---|---|
| #20 Portion Genie → **"True-Scale AR Menu"** | **BUILD — #1** | Original scope (AI vision scale + voice) is fantasy; strip it. "See this bowl life-size on your table" = model-viewer embed on menu pages + Higgsfield GLB per hero item. Answers real portion anxiety; works for every visitor; no game, no app, no AR SDK. Risk: AI food meshes can look melty — QA per item, hero items only (8–12). | **0.8** (0.55) |
| #22 Crazy Filter → **Snap AI Lenses + TikTok** | **BUILD — #2** | IG surface is gone (Spark dead) and branded-filter fatigue is real. BUT Easy Lens/Lens Studio AI makes creation near-free, Snapchat skews to the student demo near our stores (SLU/WashU), TikTok Effect House covers the rest. Needs in-store QR + creator seeding — organic lens discovery alone won't carry it. | **0.7** (0.65) |
| #19 Scan-to-Life mascot | **PILOT — #3** | The hidden cost is print ops (packaging/decals across franchise stores), not code. First-scan novelty ≠ retention. BUT MindAR (free) + Higgsfield mascot assets + LLM-rotated jokes make a 6-store **table-tent pilot** cheap and measurable. Prove scan-rate before any packaging run. | **0.55** (0.75) |
| #21 Streak City | **PARK** | Verified-visit streaks require loyalty/POS integration we don't have (Paytronix is a closed third party). Unverifiable streaks = fake game. Competes with live Crazy Points. Revisit only if loyalty provider API opens. | 0.35 (0.6) |
| #18 Bowl Hunt | **KILL** | Pokémon Go had 20 years of IP + global density; we have ~6–8 stores in one metro and no game IP — the spawn map is empty. Geospawn backend + safety/liability (directing foot traffic, minors, location data) is XL for an unproven payoff, and the assumed platform (hosted 8th Wall world-scale AR) no longer exists. | 0.15 (0.5) |

### AR sequencing
1. **True-Scale AR Menu** (2 weeks: generate GLB/USDZ for 8–12 hero bowls → QA → model-viewer embeds on /menu/:slug).
2. **Snap AI Lens + TikTok effect** (1–2 weeks incl. seeding plan; measure shares/scans).
3. **Scan-to-Life table-tent pilot** (gate: >X% scan rate in 30 days before packaging spend).

## 5. Guardrails
- Camera/location: permission-first, never store precise location, no tracking-heavy installs (web + native lens platforms only).
- All AR/quiz output must pass ai-slop-check + accessibility-audit (incl. reduced-motion fallbacks; AR always has a non-AR fallback view).
- Brand voice on every surface: /10x → /ghost; no generic filter clichés.

## 6. Sources
- Framer MCP live audit of Crazy Bowls_V1 (pages, components, code files) — 2026-07-11
- Road to VR: 8th Wall open-sourced, hosted services offline (roadtovr.com/niantic-webar-platform-8th-wall-open-source)
- 8thwall.org / 8thwall.com/pricing — hosted retirement dates
- Meta Spark shutdown announcement (spark.meta.com/blog/meta-spark-announcement; 9to5mac.com 2024-08-27)
- Snap Lens Studio AI / Easy Lens (developers.snap.com/lens-studio/features/lens-studio-ai; ar.snap.com/blog/genai-suite-lens-studio-5.0)
- MindAR — MIT-licensed WebAR image/face tracking (github.com/hiukim/mind-ar-js)
- Image-to-3D → GLB → model-viewer pipeline state (meshy.ai, hyper3d.ai, image3d.io guides, 2026)
- CBW footprint: Yelp/Tripadvisor/orderexperience.net location listings (St. Louis metro)
- Competitor observations: order.sweetgreen.com, order.tendergreens.com, chipotle.com (per original audit brief)

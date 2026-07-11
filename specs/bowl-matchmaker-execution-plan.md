# Bowl Matchmaker + Delight Layer — Execution Plan

**Status:** Ready to build (P0 start on sign-off)
**Parent:** specs/crazy-bowls-ux-strategy.md (Phase 2)
**Date:** 2026-07-11

## 1. Objective & business case

Turn "browse a menu" into "4 taps → your soulmate bowl → order it." Maximum brand differentiation (whitespace vs. Sweetgreen/Chipotle/Tender Greens), zero backend, routes into existing order hand-off.

Why quizzes (sources in §8): product-recommendation quizzes embedded on relevant pages convert ~94% higher than passive content; quiz starts convert to action ~40%; completion runs ~65–73%; quiz-driven recommendations see ~4.2× higher add-to-cart vs. static recommendations. Even discounted heavily for a restaurant hand-off context, this is the highest-leverage interactive unit we can ship.

**Success metrics:** quiz starts / menu-page sessions ≥ 8%; completion ≥ 60%; result→order-CTA click ≥ 25%; shares ≥ 5% of completions. All measurable client-side (UTM + events), no backend.

## 2. Architecture (verified against live project 2026-07-11)

- **One Framer code component:** `BowlMatchmaker.tsx` (React, client-side state, Framer Motion for animation — no external deps beyond what Framer ships).
- **Placement:** new page `/matchmaker` + entry chip on `/` hero and `/menu` ("Can't decide? We can.").
- **Data:** outcomes map to real items in the Menu CMS collection (`fEfKTjIH1`): Main Title (`fIwxSF70L`), Calories (`Du4yxFxRV`), Protein (`mD5e0_FmL`), Carbs (`RxAestyVQ`), Color (`YyYuH8o3V`), Short Ingredients (`IFoMCHzs_`), Thumbnail (`o5P7Ztu2L`), Button Link (`ZSKCb56q4`). Outcome table compiled into the component (12–14 items) so the quiz has zero runtime dependencies; refresh script re-reads CMS when menu changes.
- **Result state in URL** (`/matchmaker?r=heat-seeker&b=buffalo-bowl`) so results are shareable and reproducible.
- **Share card:** client-side canvas → PNG → Web Share API (mobile) / download+copy-link (desktop).
- **Hand-off:** order CTA deep-links to `order.online` / `orderexperience.net` with UTM (`utm_source=site&utm_medium=matchmaker&utm_campaign=<archetype>`).
- **No PII, no storage** beyond localStorage for "retake" convenience. No camera, no location.

## 3. Quiz design (4 taps)

| # | Question | Axis |
|---|---|---|
| 1 | "What's the vibe today?" (Zen / Fired up / Comfort me / Surprise me) | mood |
| 2 | "Heat check." (1–5 chili slider) | spice |
| 3 | "What's the mission?" (Protein up / Keep it light / Full send / Fuel the day) | goal |
| 4 | "How crazy are we talking?" (Sensible → Certifiable, 4 steps) | crazy index |

**Outcome map (real items, real macros):** High-Protein Bowl (62g protein), Poke Bowl, Buffalo Bowl/Wrap, Thai Bowl, Jerk Bowl, Fajita Bowl, Mediterranean Bowl, Pesto Bowl/Wrap, Power Bowl, Teriyaki Bowl, Caesar Bowl, BBQ Bowl. Bowl-vs-wrap variant chosen by Q3 (light → wrap or lettuce wrap). Crazy index 4/4 appends the Lobster Rangoon wildcard ("…and you're legally required to try the Lobster Rangoon").

**Archetypes (result IP):** each outcome = named personality + tagline + CMS brand color, e.g. The Heat Seeker (Buffalo), The Zen Machine (Teriyaki), The Gains Goblin (High-Protein), The Island Optimist (Jerk), The Mediterranean Main Character, The Overachiever (Power). Copy passes /10x → /ghost; every archetype name must survive /critique.

## 4. Phased execution

| Phase | Deliverable | Skills/tools | Gate (acceptance) | Conf. |
|---|---|---|---|---|
| **P0** | 3 wireframe directions + 1 chosen aesthetic (1–2 d) | wireframe, generate-variations, frontend-aesthetic-direction | Elle picks direction; passes ai-slop-check | 0.9 |
| **P1** | Quiz engine + outcome matrix in `BowlMatchmaker.tsx`, static styling (2–3 d) | Framer MCP createCodeFile; scoring = weighted matrix, deterministic | All 320 answer paths resolve to a valid item; URL state works | 0.85 |
| **P2** | Reveal + share card + UTM hand-off (2 d) | canvas share card; Web Share API w/ download fallback | Share works iOS Safari/Android Chrome/desktop; CTA carries UTM | 0.8 |
| **P3** | Delight layer (bank in §5; ship the ≥0.75 tier) (2–3 d) | Framer Motion; interaction-states-pass | 60fps on mid-range mobile; full `prefers-reduced-motion` fallback | 0.8 |
| **P4** | QA gates (1 d) | accessibility-audit, ai-slop-check, hierarchy-rhythm-review, polish-pass | Keyboard-completable; WCAG AA contrast; no slop tells | 0.85 |
| **P5** | Launch + measure (0.5 d + 2 wk observation) | UTM dashboards; homepage/menu entry chips live | §1 metrics instrumented; iteration list drafted | 0.75 |

Total: ~8–11 working days. Failure-simulation flags: (a) share card is the most fragile (browser canvas quirks) — build download fallback first; (b) archetype copy is the brand risk — /critique pass mandatory; (c) don't let delight block launch — P3 tiers are cuttable.

## 5. Delight bank — 10+ per journey phase

Ship the ≥0.75 tier per phase; the rest is backlog. All motion springs (no bounce-ease slop), all gated by `prefers-reduced-motion`.

### Phase A — Entry (the invitation)
1. Reuse the live TextTicker: "Everyone's crazy about something — what's yours?" flows into the start CTA (0.85)
2. "Can't decide? We can." floating chip on /menu — highest-intent entry point (0.85)
3. Honesty copy under CTA: "27 seconds. 4 taps. 1 soulmate bowl." (0.8)
4. Loading = bowl filling with ingredients; a spinner never appears anywhere (0.8)
5. Hand-drawn wiggling arrow doodle (matches logo language) pointing at start (0.8)
6. Start button label rotates per visit: "Find my bowl" / "Make me crazy" / "Feed me right" (0.75)
7. Time-aware greeting: before 10:30am offers breakfast mode — "Up early? Crazy." (0.75)
8. Bowl peeks from screen edge; an ingredient occasionally hops out and back (0.7)
9. Desktop cursor becomes a tiny avocado inside the quiz surface (0.6)
10. Long-press the logo → it does a full spin and winks (pure easter egg) (0.5)

### Phase B — Questions (the play)
1. Answer cards are illustrated ingredients that physically toss into an on-screen bowl per tap (0.85)
2. Progress indicator IS the bowl filling — no progress bar exists (0.85)
3. Spice question warms the whole screen tint per level; 5/5 emits a brief steam wisp (0.8)
4. Every tap earns a one-line reaction: "Bold. We respect it." / "The tofu understands you." (0.8)
5. Every question has one mildly unhinged option ("Surprise me. I trust no one.") (0.8)
6. Springy tap physics on cards (scale + settle) (0.75)
7. Back button reads "Wait, I panicked" (0.75)
8. Question exit: previous card gets chopped in half and drops offscreen (0.7)
9. Shake-to-random ("Ask the bowl") on mobile per question (0.6)
10. Optional tiny "chop" sound per tap — OFF by default, toggle visible (0.5)

### Phase C — Reveal (the payoff — peak-end rule: spend the motion budget here)
1. Archetype name + tagline set in Passion One, tinted with the item's CMS brand color (0.9)
2. Drumroll: bowl shakes, lid lifts, steam puff → result card (0.85)
3. Confetti is ingredients, never paper (0.85)
4. Real macro chips from CMS — 62g protein is a delight when it's true (0.85)
5. "Crazy Meter" gauge: where this bowl sits, Sensible → Certifiable (0.8)
6. Crazy-index 4/4 appends the Lobster Rangoon wildcard rider (0.8)
7. Compatibility line: "97% match. The other 3% is up to you." (0.75)
8. Runner-up shown as "Your rebound bowl" (0.7)
9. Result card flips like a trading card — art front, stats back (0.7)
10. Rarity line ("Rare pull: only 8% land The Gains Goblin") — computed from real matrix odds, never faked (0.6)

### Phase D — Share & hand-off (the loop)
1. Order CTA "Claim your bowl" → deep link + UTM; nearest-location context via existing OpenNowBadge ("Your bowl is 1.2 mi away and awake") (0.9)
2. Stateful result URL — any share reproduces the exact result (0.85)
3. One-tap share card PNG (archetype art + name) via Web Share API (0.8)
4. Copy-link confirmation: "Link copied. Go be crazy." (0.8)
5. Remix button: "Same vibe, more heat" — retake with one axis changed (0.75)
6. Exit-intent copy: "Leaving without a bowl? Bold strategy." (0.75)
7. Prewritten lunch-crew text: "I got The Heat Seeker. Fight me. [link]" (0.7)
8. Return hook: "Bowl moods change. Come back tomorrow." (0.6)
9. Mini "bowl adoption certificate" downloadable (0.55)
10. Seasonal share-card frames (LTO tie-in slot for future campaigns) (0.55)

## 6. Guardrails
- Full keyboard path + visible focus rings; quiz completable with zero animation (`prefers-reduced-motion` swaps all motion for crossfades).
- No fake numbers ever (rarity/compatibility must be real math or cut).
- No PII collection; share is user-initiated only.
- All copy: /10x → /ghost → /critique. All UI: ai-slop-check + polish-pass before publish.

## 7. What P1 unlocks later
Archetypes become reusable brand IP: share-card frames for LTOs, "Crazy Meter" feeds the Good↔Crazy Map (Phase 3), quiz axes seed the Bowl Builder's default suggestions, archetype names become loyalty badge names if Paytronix ever opens up.

## 8. Sources
- Interact Quiz Conversion Rate Report 2026 — ~40% start→lead conversion (tryinteract.com/blog/quiz-conversion-rate-report)
- Amra & Elma Interactive Quiz Statistics 2026 — embedded product quizzes +94% vs. passive; 4.2× add-to-cart; 73.4% completion (amraandelma.com/interactive-quiz-statistics-marketing)
- LeadQuizzes — 50 quiz marketing stats/case studies (leadquizzes.com/blog/quiz-marketing-statistics-and-case-studies)
- Live Framer audit 2026-07-11: Menu CMS (99 items, field IDs above), TextTicker/OpenNowBadge components, palette + type system
- Peak-end rule (Kahneman) — motion budget concentrated at reveal
- Precedents: BuzzFeed identity-quiz share mechanics; Spotify Wrapped shareable-card loop

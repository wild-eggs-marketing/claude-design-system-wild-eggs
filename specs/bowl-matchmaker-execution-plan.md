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

---

## 9. BUILD RECORD — 2026-07-11

Shipped to Framer project "Crazy Bowls_V1" (branded **Quiz Your Crazy**):
- Code component `QuizYourCrazy.tsx` (codeFileId `NnaX1N5`, clean typecheck). 4-tap quiz, deterministic scoring over 14 real Menu-CMS items (real photos/macros), archetype reveal (Gains Goblin, Heat Seeker, Peanut Prophet…), bowl-fill progress SVG, tap reactions, heat-tint background, ingredient confetti, Crazy Meter, Lobster Rangoon certifiable rider, UTM'd order CTA, copy-link share, stateful result URLs (?qcr=slug&c=n), remix ("same vibe, more heat"), prefers-reduced-motion + aria-live + keyboard support.
- Page `/quiz-your-crazy` (nodeId HMzL3QfqS): replaced 404 placeholder with Navbar (PoYU29bBM) → QuizYourCrazy (Vb6tEwvIc) → Footer (OpzCc_ZXo).
- NOT yet published — publish from the Framer editor to push live.

## 10. AI leverage stack — 10x output & delight plays (ranked)

| # | Play | Tool/repo | Why | Conf. |
|---|---|---|---|---|
| 1 | Archetype trading-card art (14 illustrated cards, brand palette) + cutouts | Higgsfield MCP generate_image + remove_background (connected) | Turns results into collectible IP; feeds share cards + ads | 0.85 |
| 2 | Nightly copy engine: rotating quiz reactions/taglines/ticker lines batch-written into CMS | Claude API (haiku for volume) + Framer MCP upsertCMSItem | Quiz never feels stale; LLM in the loop, not runtime | 0.8 |
| 3 | Physics ingredient confetti + upgrade path to animated mascot | canvas-confetti (custom SVG shapes), Rive | Signature delight at near-zero cost; battle-tested OSS | 0.8 |
| 4 | 3D bowl on reveal + True-Scale AR menu | Higgsfield generate_3d → GLB + google/model-viewer | Ties quiz to AR play #1; photo→3D now minutes | 0.8 |
| 5 | Personalized archetype reveal videos (14 pre-rendered MP4s; reusable for Reels/ads) | Remotion (remotion.dev) | Programmatic video = every LTO gets a video for free | 0.75 |
| 6 | Archetype-level ad intelligence: UTM campaigns per archetype → GA4/Meta readback → retarget by personality segment | Windsor.ai MCP (connected) + Claude Ads audit | Quiz answers = zero-party data; closes marketing loop | 0.75 |
| 7 | In-browser AI bonus question: free-text "describe your mood" → zero-shot classified to quiz axes, on-device | huggingface/transformers.js (WebGPU) | Real AI, no backend, no PII leaves the device | 0.7 |
| 8 | Export quiz components to React repo for CI/tests/review loops | unframer (remorses/unframer) | Real engineering rigor on Framer code | 0.7 |
| 9 | Archetype AR lenses ("unlock your Heat Seeker lens") | Snap Lens Studio AI / Easy Lens | Bridges quiz → AR play #2; text-prompt lens creation | 0.65 |
| 10 | Quiz-reveal → deterministic share MP4s from HTML | HyperFrames (heygen-com, 23.7K stars) | Same reveal HTML becomes the video asset | 0.65 |
| 11 | Pre-launch creative scoring of share cards/videos | Higgsfield virality_predictor | Pick winning variant per archetype before spend | 0.6 |
| 12 | Per-archetype OG preview images so shared links unfurl as archetype cards | vercel/satori or 14 pre-generated OGs | Share loop CTR; constrained by Framer per-page OG | 0.6 |

## 11. Revisions — 2026-07-11 (later)

**Higgsfield dropped (no paid plan).** Replacements:
- Archetype card art → **code-crafted canvas share cards** using real bowl photos + brand type/colors (shipped, see below). Zero cost, zero AI-slop risk, brand-true.
- Future illustration needs → Pollinations.ai (keyless, free) or HF Inference free tier (FLUX.1-schnell).
- 3D (AR menu play) → TripoSR (open source, Hugging Face) or Meshy free tier → GLB for model-viewer.
- Background removal → RMBG via transformers.js / rembg (open source).
- Virality scoring → dropped; replace with GA4 A/B readback via Windsor.ai.
- Remotion/HyperFrames plays unaffected (free OSS).

**Shipped in `QuizYourCrazy.tsx` (rev 2, clean typecheck):**
1. **Share card generator** — canvas-rendered 1080×1350 PNG (archetype name auto-fit in Passion One, circular bowl photo w/ CORS fallback, tagline, macro chips, Crazy Meter bar, squiggle, URL footer). Web Share API w/ files on mobile; PNG download + link copy on desktop. Button states: "Get my bowl card" → "Plating your card..." → "Card saved. Link copied. Go be crazy."
2. **BuzzFeed-voice copy pass** on every string, per human-voice/anti-AI rules (no em-dashes, no filler, no performative emoji; oddly-specific self-recognition humor): "Pick a mood. Be honest." / "Zen. Do not perceive me." / "Comfort me like a carb." / "Mild. I have a meeting at 2." / "Fuel. I have 47 tabs open." / "Crazier than my group chat." / reactions like "The quinoa will whisper." and "Legal has been notified. Proceed." / reveal kicker "Results are in. Try to act surprised." / retake link "Retake it. Nobody has to know." Archetype taglines rewritten as BuzzFeed-style result payoffs ("62 grams of protein. You flex reaching for the salt.").

## 12. Audit + visual feedback round — 2026-07-11 (rev 4 shipped)

**Self-audit findings (all fixed in rev 3):** double-tap race skipping questions; match % floor Math.max(72) violated our no-fake-numbers rule (removed, honest % + "opposites attract" line for low scores); hardcoded 97% on shared links (removed; shared reveals show no %); SVG clipPath id collision (useId); focus not moved to question heading for screen readers (fixed); matchMedia legacy Safari fallback; arbitrary runner-up on shared links (hidden); remix no-op at heat 5 (button hidden).

**Elle's visual feedback (all fixed in rev 4):** white background + CornerDoodles layer (lime/apricot/dragonfruit/teal/yellow hand-drawn accents) for color+contrast; topPadding prop (default 170px) clears overlay nav; duplicate Navbar/Footer instances removed (site-wide chrome only); motion made legible: 1200ms reaction beat, selected card fills question color + check + hard shadow, others dim to 35%, bowl progress bumps/rotates and fills per answer, 120px spring slide between questions, staggered option entrance, per-question accent color (teal/apricot/dragonfruit/lime), "QUESTION X OF 4" kicker, reveal wrapped in cream card w/ lime hard shadow, CTA hard shadows.

**Personalization/virality shipped (rev 4):** optional first-name field → name on reveal + share card ("OFFICIAL RESULT FOR ELLE"); localStorage welcome-back ("Welcome back, Pesto Romantic. Same crazy today, or new crazy?"); friend-vs-you head-to-head (shared-link taker who retakes sees "They got X. You got Y. Lunch just got interesting."); personalized share text; card redesigned white frame + cream panel.

**Known handoff item:** live editor session moved the QuizYourCrazy instance (Vb6tEwvIc) and old FooterSection (OpzCc_ZXo) OUTSIDE the Desktop breakpoint frame; MCP writes to that page are blocked while the editor is open. Manual fix in editor: drag QuizYourCrazy layer inside Desktop frame (top of stack), delete loose FooterSection. Component itself is linked to the code file, so all rev-4 changes apply automatically.

## 13. Padding/clipping fix — 2026-07-11 (rev 5)

Root cause: quiz instance had been placed inside the hero's clipped BackgroundWrapper (absolute, bottom -830px), so the footer rendered at the hero's natural height and the wallpaper painted over the quiz. Fixes: reparented instance into page flow (HeroSection child, width 1fr, fit-content); hero padding zeroed; component root now creates its own stacking context (zIndex 2) and defaults to transparent background so the section wallpaper shows around content; question + reveal screens wrapped in solid white cards (green border, per-question color hard shadow) so text never fights the wallpaper; new props bottomPadding (140) and transparentBg. Structure verified: Desktop > HeroSection(wallpaper bg + quiz in flow) > FooterSection.

## 14. Rev 6 + 7 — live-state feedback + full copy audit (2026-07-11)

**Rev 6 (UX):** reaction beat 1200→1800ms (new "Reaction Time" instance prop, 600–4000ms); reveal card compressed to fit desktop viewports (200px photo, clamped type, tighter gaps); fluid clamp() type + padding across breakpoints; rebound link fixed /menu → /menu/{slug} (real CMS detail pages); Crazy Points enrollment block added post-reveal (join + sign-in URLs as instance props, UTM-tagged per archetype) — Chipotle pattern: never gate the quiz, capture identity after the payoff via loyalty.

**Rev 7 (copy audit — root bug + 12 upgrades):**
0. BUG: reloading your own result URL triggered the "shared by a friend" copy path. Fixed: qcr param matching this device's stored result = return visit, not share.
1. Return-visit reveal: kicker "Back for more. Respect." line "Buffalo Bowl. Still yours. The bowl waited. It knew you'd be back."
2. Shared reveal rewritten as a story: kicker "Incoming: a friend's accusation" line "A friend says you're Buffalo Bowl material. Bold claim. Take the quiz and settle it."
3. Head-to-head sharpened: "They called you X. You're actually Y. Lunch just got interesting." / same-bowl: "Your friend called it. That's either beautiful or concerning."
4. Intro: "Four questions. One diagnosis. Zero judgment." / "It's science. Loosely. Very loosely."
5. Name field placeholder: "Name for the trophy (optional)".
6. Heat prompt: "How brave is your tongue today?"
7. Medium-heat reaction: "The people's choice. Democracy works."
8. Low-match line: "The rest is chemistry." (replaces confusing "And climbing. Opposites attract.")
9. Crazy Meter level 3 renamed "Crazier than most" (was bare "Crazier"), shared across meter + canvas card.
10. Rangoon rider: "Certifiable clause:" (was "rider," insider jargon).
11. Rewards block: "Get points for being like this. Crazy Points turns bowls into free bowls."
12. Rebound link: "Your rebound: the Thai Bowl. We won't tell." (and no longer 404s).
Also: remix hidden on return visits (no answers to remix).

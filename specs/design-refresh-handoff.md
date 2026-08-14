# Design Refresh — Cross-Brand Handoff Brief

**Purpose:** Context transfer for a NEW thread taking on a design refresh across **both brands** —
Crazy Bowls & Wraps and Wild Eggs. Written to be pasted/opened cold. No credentials included.
**From:** the Quiz Your Crazy build thread. **Date:** 2026-07-12.
**Owner:** Elle (elle@wildeggs.com), Brand + AI Engineering.

---

## 0. How to start the new thread (paste this)

> You are Brand Leader + lead AI engineer for **Wild Eggs** and **Crazy Bowls & Wraps**.
> Read `specs/design-refresh-handoff.md`, `specs/crazy-bowls-ux-strategy.md`, and
> `specs/bowl-matchmaker-execution-plan.md` first — they carry all prior context.
> Adopt the operating model in §4 (Advisory Panel + the repo's Claude Design System + skills)
> and the standing rules in §5. The task is a design refresh across BOTH brands; start with the
> discovery in §6 before changing anything.

---

## 1. The two brands

### Crazy Bowls & Wraps (fully mapped this thread)
- **Live:** crazybowlsandwraps.com (custom domain) · staging `crazybowlsandwraps.framer.website`
- **Framer project:** "Crazy Bowls_V1" — projectId `LShpj7mpHt9MftDLGfwe`
- **Palette (Framer color styles):** Teal `rgb(13,79,79)` · Cream/Background `rgb(255,242,230)` ·
  Cream-Brand `rgb(245,238,227)` · Dragonfruit `rgb(218,45,101)` · Lime `rgb(163,191,30)` ·
  Warm Apricot `rgb(242,119,78)` · Yellow `rgb(246,192,52)` · Green `rgb(18,58,20)` · Ink `rgb(28,43,28)`
- **Type:** Passion One (display headings, uppercase) · Bricolage Grotesque (body, weights 500/700/800)
- **Brand voice:** playful, "a little bit crazy," "Go for the good." Contrarian but food-flattering.
- **Ordering is OFF-SITE:** delivery `crazybowlswraps.order.online`, pickup `…orderexperience.net`.
  The site's job is Discovery → Delight → Decision → hand-off. It cannot own a cart.
- **Loyalty:** Crazy Points via `crazybowlsandwraps.myguestaccount.com` (Paytronix-style, closed API).
- **Footprint:** ~6–8 locations, St. Louis metro.
- **Signature brand devices:** hand-drawn doodle language (matches logo), lime squiggle underline,
  hard offset shadows on cards, animated ticker ("Everyone's crazy about something").

### Wild Eggs (NOT yet mapped — first job of the new thread)
- **Live:** wildeggs.com · breakfast/brunch brand · ~13 locations (per GA4 + Google Business).
- **POS:** Toast (see the `wild-eggs-modifier-triage` skill; ~16,000 modifier records).
- **Unknowns to gather:** Framer project (if any) / site platform, palette, type, voice, ordering
  path, loyalty. **Do not assume it mirrors Crazy Bowls.** Audit before designing.
- **Relationship:** shared ownership with Crazy Bowls; the refresh must decide what's SHARED
  (system, tooling, tokens architecture) vs. DISTINCT (each brand keeps its own palette/voice).

---

## 2. What shipped this thread (Crazy Bowls)

**"Quiz Your Crazy"** — a 4-tap Bowl Matchmaker personality quiz. Live, published, instrumented.
- **Component:** Framer code file `QuizYourCrazy.tsx`, codeFileId `NnaX1N5`.
- **Page:** `/quiz-your-crazy`, page nodeId `HMzL3QfqS`; instance inside the hero section frame.
- **Data:** 14 archetypes mapped to real Menu CMS items (collection `fEfKTjIH1`) — real macros/photos.
- **Feature set:** deterministic scoring; archetype reveal (name-as-hero); canvas share cards in
  BOTH feed (1080×1350) and story (1080×1920) formats via `drawCover` (no squish); live domain on
  card; stateful shareable URLs; friend "accusation"/head-to-head loop; return-visit memory
  (localStorage); Crazy Points enrollment block; per-question accent colors; reduced-motion + a11y.
- **Analytics:** `track()` → GA4 (gtag) / GTM (dataLayer) / Plausible. Key event = `quiz_complete`
  (fired once from final answer, real playthroughs only, w/ archetype/bowl/match/crazy_level).
  Also quiz_start, quiz_share, quiz_order_click, quiz_rewards_join, +re-engagement events.
- **Open follow-ups:** (a) confirm GA4 gtag tag is present on the live page (property "Crazy Bowls"
  469819156 exists via Windsor; event flow to the page itself unverified); (b) mark `quiz_complete`
  a key event in GA4 Admin (console toggle — no connected tool can do it); (c) RESOLVED:
  `crazybowlsandwraps.com/quiz-your-crazy` returns 200 (verified during promo-email-loop E1).

---

## 3. Repo + where things live

- **Repo:** `wild-eggs-marketing/claude-design-system-wild-eggs` (transferred from ellemaculate 2026-08-14; old URLs redirect) · branch `claude/crazy-bowls-ux-strategy-fhkgky`.
- **This repo IS a Claude Design System** — `claude/system-prompt.md` (20-chapter design philosophy)
  + `claude/skills/` (15 skills incl. `promo-email-loop` — the render-verified email workflow).
- **Specs (read all three):**
  - `specs/crazy-bowls-ux-strategy.md` — strategy, competitive audit, AR verdict, idea ranking.
  - `specs/bowl-matchmaker-execution-plan.md` — full quiz build log, revs 1–12, delight bank, AI stack.
  - `specs/design-refresh-handoff.md` — this file.
- The quiz component source lives ONLY in Framer (not the repo). To edit: Framer MCP
  `updateCodeFile` on codeFileId `NnaX1N5` (full-file replace; ~700 lines; save can time out —
  verify with `readCodeFile` + grep, the write usually applied).

## 4. Operating model (carry forward)

- **Advisory Panel** on strategy calls (Challenger / Root-Cause / Opportunity / Fresh Eyes / Action Coach).
- **Slash-command discipline:** `/steelman` + `/devil` + Failure Simulation before committing;
  `/scout` pre-ship; `/10x` → `/ghost` → `/critique` on copy; `/brief` to close/hand off.
- **Design skills** (repo `claude/skills/`) on every design task; gate with ai-slop-check +
  accessibility-audit + hierarchy-rhythm-review + polish-pass before publish.
- **Commit cadence:** every change recorded in the relevant spec + committed to the branch.

## 5. Standing rules (established — do not relearn the hard way)

1. **Food-first copy:** tease the person, never the plate. The dish is always the hero.
2. **No fake numbers, ever:** every %/count/rarity is real math or it's cut.
3. **Accessibility is non-negotiable:** keyboard-completable, visible focus, `prefers-reduced-motion`
   fallback, WCAG AA contrast, aria-live for dynamic text.
4. **Human voice / anti-AI:** no em-dashes (EXCEPT `&mdash;` in email body copy — house precedent),
   no filler, no performative emoji; BuzzFeed-style second-person humor for consumer copy.
5. **Brand-true assets:** real photography + real CMS data; no weak AI illustration as a crutch.
6. **Motion legibility:** springs not bounce-slop; one system moves at a time; enough dwell to read.
7. **Off-site ordering (Crazy Bowls):** design toward hand-off, never a fake on-site cart.
8. **Capture identity AFTER the payoff, via loyalty** (Chipotle pattern) — never gate play.
9. **Render before review:** anything visual (emails, cards, pages) passes a Chromium render gate
   at desktop + mobile widths before a human sees it (see `promo-email-loop` skill for the recipe).

## 6. Design-refresh discovery (do this BEFORE designing)

1. **Get Wild Eggs into the session** — its Framer project or site platform, then run
   `design-system-extract` + `component-extract` to pull its real tokens/components (don't guess).
2. **Audit both live sites** — screenshot passes, ai-slop-check, hierarchy-rhythm-review per brand.
3. **Decide the system architecture** — one shared token/skill foundation with two brand themes,
   vs. fully separate. Recommendation to pressure-test: shared *structure + tooling + a11y +
   voice rules*, distinct *palette + type + personality* per brand. Confirm with Elle.
4. **Baseline metrics** — pull each brand's GA4 (Windsor: "Crazy Bowls" 469819156;
   "new - www.wildeggs.com - GA4" 386346645) so the refresh is measured, not vibes.

## 7. Connected tools available to the new thread (auth state as of handoff)

- **Framer MCP** — Crazy Bowls project (live). Wild Eggs: attach if it's on Framer.
- **Proofly MCP** — full Framer design/audit tool suite (SEO, a11y, perf audits, palette/type
  generators, React export). Strong fit for a systematic refresh.
- **Canva MCP** — authorized (brand kits, brand templates, exports) — good for cross-brand
  collateral once tokens are set.
- **Windsor.ai** — reads GA4 for both brands + ads + Search Console + Google Business. Read-only
  for GA4; write actions only for ad platforms.
- **Semrush** — SEO/traffic/competitive intel for both domains.
- **Google Drive, GitHub, Microsoft 365, monday.com, Jotform, OpenArt, Higgsfield.**
  Note: **Higgsfield has no paid plan** — for image/3D use free alts (OpenArt, Pollinations,
  HF Inference, TripoSR) per the AI-stack notes in the execution-plan spec.
- **Chromium + Playwright preinstalled** (/opt/pw-browsers) — the render-gate engine.
- **Auth caveat:** MCP connections flake between turns; verify a server is live before relying on it.
  Git push credentials also rotate on container resets — push early, verify remote HEAD.

## 8. What NOT to touch without sign-off

- Live quiz component `NnaX1N5` (in production; changes need a QA + publish pass).
- Crazy Bowls palette/type as brand foundations (refresh may extend, not replace, without approval).
- Anything implying Wild Eggs mirrors Crazy Bowls until §6.1 audit proves the real Wild Eggs system.

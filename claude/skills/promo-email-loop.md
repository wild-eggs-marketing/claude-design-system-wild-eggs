# Promo Email Loop

Produce a paste-ready Paytronix promo email in the CBW/Wild Eggs house design system and voice,
render-verified before the human ever reviews it. Locked 2026-08-14 after eval E1 (CHIP YEAH):
the loop's gates caught 2 ship-blocking bugs that 4 human review cycles had missed.

**Trigger:** any request to create/update a marketing or promo email for either brand.
**Invocation shorthand:** "Run the promo email loop. Brief: …"

## Brief format (INTAKE contract)

One line minimum: `offer item · threshold · code (or "no code") · redemption location · end date · CTA URL · image URLs`.
Example: `free large chip platter · $150+ catering pre-tax · CHIPYEAH at online checkout · thru 8/18 · crazybowlsandwraps.com/catering · [4 image links]`.

INTAKE rules — never invent a fact:
- Missing field → one consolidated question to the human, not a drip.
- "No code" mechanic → the code tag element is REMOVED, never faked.
- Cross-brand: Wild Eggs sends require the WE reference email first; never assume CBW's system.

## The graph

BRIEF → INTAKE → ASSETS → PLAN → BUILD → VERIFY(G1,G2,G3) → REVISE(≤3/gate) → PACKAGE → HUMAN GATE → MEASURE → LEARN

- ASSETS: curl every image, view each one, write alt text from what is actually in it, recommend slots.
- PLAN: map slots to the latest reference send's patterns; subject ×3 + preheader ×2; pun bank ≥8.
- BUILD: start from the latest reference HTML as the literal skeleton; change content, never system
  (tokens, fonts, motion classes, `template:link` tags stay byte-identical).
- REVISE consumes only the failure report; re-run only the failed gate (+G2 if layout touched).
- Escalate to the human after 3 failed cycles on one gate, or 30 min / ~150k tokens.

## Gate G1 — mechanical (grep + curl)

- Offer item, threshold, code, end date each appear ≥2× (code and date ≥3× counting preheader),
  with zero contradictions between preheader / body / terms.
- Terms line includes: threshold + "(pre-tax)", full end date, code + redemption location,
  "One per order. Not stackable with other offers."
- `grep -c 'framer.website'` = 0 in rendered strings (staging-domain leak check).
- Every href curls 200 (follow redirects, 12s timeout). WHITELIST: `rel="preconnect"` origins.
- Every link carries utm_source=paytronix, utm_medium=email, unique utm_campaign per send,
  unique utm_content per slot (primary-cta may appear 2× — MSO + non-MSO fallback).
- `template:link` unsubscribe + campaign_view tags present (6 tag occurrences).

## Gate G2 — visual render (the money gate)

Prep: build render.html — curl every image + the Google Fonts css2 URL (Chrome UA for woff2),
inline all as data: URIs. This keeps TLS intact (curl trusts the proxy CA; the browser runs offline)
and validates every asset URL as a side effect.

Render (Chromium is preinstalled at /opt/pw-browsers/*/chrome-linux/chrome):

    chrome --headless=new --no-sandbox --no-proxy-server --hide-scrollbars \
      --force-prefers-reduced-motion --window-size=600,H --screenshot=d.png file://render.html
    # repeat at --window-size=375,H

`--force-prefers-reduced-motion` is MANDATORY — intro animations start at opacity:0 and a frame-zero
capture produces false "missing element" bugs (learned in E1).

Numeric assertion via playwright-core (npm i playwright-core, executablePath = the chrome above):
`document.scrollingElement.scrollWidth <= viewport` at BOTH 375 and 600. On failure, enumerate
elements with getBoundingClientRect().width > viewport to name the culprit — never guess.

Vision review of both screenshots, 6 points: (1) no clipping, (2) no image distortion/squish,
(3) correct image in correct slot, (4) text contrast, (5) button integrity, (6) all images loaded.

## Gate G3 — voice

- ≥6 distinct puns, placed in the reference rhythm (top bar, sub-line, offer line, captions, panel).
- Food-first rule: tease the person or the logistics, NEVER the plate. The dish is always the hero.
- Banned: emoji confetti, AI-isms (delve, elevate, "in today's fast-paced world").
- ALLOWED: `&mdash;` in email body copy (house reference precedent overrides the general no-em-dash rule).
- No fake numbers anywhere, ever.

## Known house-template fixes (apply to EVERY send built from pre-2026-08-14 references)

1. Stacked colossal headlines: the sub-line `<p class="m-sub">` needs inline `display:block;`
   or it renders BESIDE the word block (both are inline-block; wide single words masked this).
2. Mobile media query: `.stack2 { display:block !important; width:100% !important;
   box-sizing:border-box !important; }` — without border-box, cell padding overflows the
   viewport by ~72px on mobile (latent in QUESO + Thirsty Thursday templates).

## PACKAGE (always ALL of these — no exceptions)

1. The verified .html file (attached).
2. **The full HTML inline in chat as a copyable TXT code block** (Paytronix paste path).
3. Both screenshots (600 + 375) as proof.
4. Subject/preheader picks + send-time recommendation (weekday AM; deadline sends on deadline day).
5. Unresolved questions flagged (e.g., "verify code validates at checkout with a $150 cart").

## HUMAN GATE — always required before execution

Sending (always) · offer terms/legal fine print · the headline pun/campaign name · any image the
human didn't supply · any claim about checkout behavior. STAYS MANUAL: Paytronix paste, test-send,
code validation at checkout, list selection, the send itself.

## MEASURE + LEARN

After the human confirms the send: pull opens→clicks→orders by utm_content (Windsor.ai → GA4).
Every human revision note and every gate finding gets appended to this file's fix list. Track
"human cycles per email" — baseline 4, current 0, target ≤1.

## Eval scorecard (pass = 6/7, * mandatory)

mechanics exact* · links 200 + UTMs unique* · visual clean at both widths* · voice gates pass ·
system-match diff clean · ≤1 human revision cycle · packaging complete (file + inline TXT + screenshots).

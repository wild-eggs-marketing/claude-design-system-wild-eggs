# Promo Chat Gate

Render gate for `components/crazy-bowls/CraziologistChat.tsx` — the same
"render before review" discipline as the `promo-email-loop` skill, applied to a
live React component instead of an email.

It boots the real component in headless Chromium against a stand-in catering
page, freezes the clock so any offer phase can be inspected on demand, stubs the
Worker so outbound payloads can be asserted, and drives the actual UI (clicks the
teaser, types into the input) rather than reading the source.

## Run

    cd tools/promo-chat-gate
    npm i --no-audit --no-fund react react-dom @types/react @types/react-dom \
      typescript esbuild playwright-core
    cp ../../components/crazy-bowls/CraziologistChat.tsx .   # entry.tsx imports ./CraziologistChat
    npx tsc -p tsconfig.json                       # typecheck
    npx esbuild entry.tsx --bundle --outfile=site/catering/bundle.js \
      --jsx=automatic --loader:.tsx=tsx --alias:framer=./framer-shim.js \
      --define:process.env.NODE_ENV='"production"'
    cp site/catering/bundle.js site/menu/bundle.js
    node verify.js                                  # 89 assertions

Fonts: `site/fonts-inline.css` is a Google Fonts css2 response with every woff2
inlined as a data: URI (curl it with a Chrome UA, then inline). Not committed —
it is ~700KB of font data. Without it the gate still passes; type just renders in
a fallback face.

If you ever rename the local copy, update `entry.tsx` and `tsconfig.json` to
match. A filename mismatch is silent and dangerous: esbuild and tsc both keep
using the stale file, so the gate passes green against code you did not change.
Confirm a real rebuild with `grep <a-string-you-just-added> site/catering/bundle.js`.

## What it asserts

**Per offer phase, at 1200x900 and 390x844**

- teaser renders with that phase's threshold, and the other phase's threshold is
  absent (catches copy that did not follow a threshold change)
- `czg_promo_teaser_shown` reaches `dataLayer`
- the teaser is a real button and opens the panel
- the offer answer renders with exact terms, no refusal/escalation language
- **the phase's end date appears in the offer answer** — phase 2 once shipped with
  no expiry anywhere in its guest-facing copy, which makes the terms incomplete
- **zero Worker calls for the offer question** — the load-bearing one, see below
- no offer facts leak into the outbound transcript
- `document.scrollingElement.scrollWidth <= viewport` with the teaser up and with
  the panel open
- the panel sits fully inside the viewport
- no page errors, no failed requests

**Routing** — the offer intercept has to be wide, but not indiscriminate

- answered locally: "What's the code?", "Any specials on catering right now?",
  "Is there a promotion going on?", "Do I get anything free with a big order?",
  "any deals?", "do you have a coupon"
- routed to the Worker: "My zip code is 63105..." (not a promo code),
  "How many wraps for 30 people?"
- routed to the Worker, always: "Any gluten free options for catering?",
  "Do you have nut free platters?", "How much protein in the power bowl?" —
  NUTRITION_RX is a hard veto on the intercept, because the Worker owns
  allergen and macro data and the Nutritionix disclaimer

**Targeting and phase windows**

- `/catering` shows the promo; `/menu` does not
- `/menu?utm_campaign=...` shows it (email traffic on any page)
- before the first phase starts, and after the last phase ends: hidden
- at the midnight handoff between phases: shown, with the new phase's copy

## Why offer answers never reach the model

Verified against the live Worker on 2026-08-18: it is grounding-hardened, has no
record of this promo, and responds by refusing to confirm it, calling `escalate`,
and sending the guest to contact-us. Injecting the offer terms into the outbound
messages did not change that. So offer questions are answered from the phase copy
in the component and never leave the browser.

Re-test with a live curl after any Worker deploy that teaches it the offer. If
the Worker learns the terms, the intercept can be relaxed — but offer copy is
legal text, so answering it locally is defensible on its own.

## Adding a phase

Append to `PROMO_PHASES` in the component, then add a `run(...)` line in
`verify.js` with that phase's threshold and id. The gate will fail if the copy
and the threshold ever disagree.

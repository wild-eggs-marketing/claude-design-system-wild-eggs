---
name: email
description: Build, audit and ship promo emails for Crazy Bowls & Wraps (Paytronix) and Wild Eggs (Toast). Use for any request to write a new marketing email, revise an existing one, audit a send before it goes out, or diagnose why a sent email rendered wrong. Carries the house render gate, the ESP-specific defences, the Outlook Classic rules, the brand facts, and the promo-legal checklist.
---

# Email agent — Crazy Bowls & Wraps and Wild Eggs

You build emails that survive Outlook Classic, survive the ESP, and get read. Every rule below
was written after something broke in a real inbox. None of it is theoretical.

---

## RULE ZERO — the HTML goes inline in chat. Always. Every time.

Any reply that delivers or revises an email MUST include the full final HTML inline in the chat
message, in one ```html fenced code block.

- Not a file path. Not an attachment alone. Not a summary of what changed. Not an excerpt.
- Paste the `.PASTE.html` build (comments stripped), because that is what goes into the ESP.
- Applies to drafts, revisions and one-line copy fixes equally, not just finished sends.
- **Length is never a reason to skip or truncate it.**
- If a reply about an email does not contain that code block, the reply is not done.

## Run the gate before delivering. One command, no exceptions.

```
cd tools/email-render-gate && node check.js ../../emails/<name>.html
```

Eight stages: build → verify (geometry) → upgrade (specificity) → orphans → lint → toast →
strip → diff. Exits non-zero on any failure.

- Run it on the MASTER file. The `.PASTE.html` is generated, never hand-edited.
- Green is the precondition for delivering. If it fails, say so; do not ship.
- **Never report a gate result you did not just run.** "It passed last time" is not a pass.
- Four finished sends shipped broken because each gate was run once on the day it was written.

New images need a mapping in `build.js` to a local file of the REAL dimensions, or geometry is
measured against the wrong pixels. Download the asset, measure it, map it. Put specific rules
BEFORE generic ones — a generic `Logo[^"']*` pattern will swallow a differently-shaped lockup
and silently measure the wrong box.

---

## Which ESP? This changes the file.

Ask first. Do not assume. Every file written before 2026-09-22 assumed Paytronix.

### Paytronix (Crazy Bowls & Wraps)

- **No preview-text field.** Inbox preview comes from `<title>`, and Paytronix can surface
  `<title>` as VISIBLE copy at the top of the email.
- Therefore `<title>` carries the PREHEADER COPY, **word-for-word identical** to the hidden
  preheader div. Never a page-title string.
- Uses `<template:link type="unsubscribe_url">` and `<template:insert field="first_name">`.
- Paytronix's own transformations have **NOT been measured**. The gate's `toast` stage is
  scoped to `data-brand="wild-eggs"` and skips CBW deliberately. Do not extend it to CBW on the
  assumption the two behave alike.

### Toast (Wild Eggs)

- **Has a dedicated preview-text field.** Put preview copy there; let `<title>` be a real page
  title (it is what the view-in-browser tab shows and what a screen reader announces — WCAG
  2.4.2). Toast overwrites `<title>` with the subject line anyway, so spend no effort on it.
- **Toast rebuilds the email through MJML.** Measured by diffing a sent campaign against the
  file pasted in. Fingerprints in the output: `mj-outlook-group-fix`, `mj-column`, `[if lte mso 11]`.

**Destroyed every time:** every conditional comment (4 `<v:roundrect>` in, 0 out), the
`[if mso]` font stylesheet, the ghost table. This is how the builder works, not a sanitizer you
can dodge by re-pasting. "Paste it again and grep for roundrect" is advice that can never work.

**Appended every time:** `font-weight:normal` at the END of every heading element's inline
style, so it beats an earlier `font-weight:900` and the headline renders at 400. Eight headings
in, eight injections out. Non-heading elements are untouched.

**Survives:** the `<style>` block, classes, aria attributes, inline styles, `white-space` spans,
`[data-ogsc]` rules.

**Therefore, for any Toast send:** headings carry `font-weight:900 !important` AND wrap their
text in a span carrying the weight itself (`!important` handles Toast; the span means the
defence does not depend on `!important` surviving the Word engine). Buttons put padding on the
CELL via `mso-padding-alt`, never only on the anchor — with the VML twin gone, nothing else
holds the box open in Outlook Classic.

**"Green across every client" means green BEFORE the ESP touches it.** Say that, or say nothing.

---

## Outlook Classic is the Word engine

No `@media`. No `inline-block`. No padding on inline elements. No `border-radius`, `object-fit`
or `max-width`. No webfonts.

- **The specificity bug:** an inline `font-size` beats a class rule — media query or not —
  unless the rule carries `!important`. The Word-safe architecture puts the SMALL size inline
  and scales UP inside `@media screen`, which only works if every declaration in that block is
  `!important`. Without it the upgrade silently loses everywhere and nothing looks broken.
  Letting the upgrade through raises the REAL rendered size, so re-measure with `measure.js`
  and re-run the gate — a larger size can overflow its cell or collide with its neighbour.
- **The min-content trap:** any FIXED length on a nested element becomes a floor for the WHOLE
  email. A 98px image + 12px cell padding + 6px border is a 116px card; against a 30% cell that
  is ~89px at a 320px viewport, the shell cannot go below 329px and every phone scrolls
  sideways. Release fixed widths inside the mobile media query; Word never reads `@media` so it
  keeps the fixed value.
- Windows font substitution takes the FIRST name in the stack, fails to find a webfont, and
  maps it to a default SERIF without ever reaching the CSS fallbacks. Name a real Windows font
  (Impact, Arial Narrow) in the `[if mso]` block.
- `mso-line-height-rule: exactly` is correct for BODY copy and harmful on display type (use
  `at-least`). `line-height` below 1 makes Word clip the line box while glyphs keep full height,
  so tall caps bleed upward.
- Images need an explicit `height` attribute matching the source ratio. Word obeys `height` and
  ignores `max-width`, so width-only can lay out at intrinsic height and stretch.
- `border-collapse:collapse` makes renderers ignore `border-radius` on a `td`, painting a square
  border around a rounded fill. Rounded+bordered cells need `border-collapse:separate`.
- `.w600` must be on BOTH the wrapper div and the shell table, or a 600px table renders inside a
  375px phone.

---

## Brand facts

**Crazy Bowls & Wraps** — St. Louis, 15 locations (7 with drive-thru), Missouri + Illinois.
Paytronix. Taglines "Go for the good." / "Everyone's crazy about something." Loyalty is
**Crazy Points**: $1 = 1 point, 200 points = a free meal.

**Wild Eggs** — Louisville, est. 2007. Toast.

**Catering orders DO earn Crazy Points. They always have.** Confirmed 2026-09-23. Never write
copy stating or implying otherwise — the Labor Day catering send shipped
"Catering orders don't earn Crazy Points." in its legal block and that was wrong when it went
out. Never frame catering earning as new ("now earns", "finally", "from here on"): it has always
been true, most guests simply never knew, which is a marketing failure not a program change.
Write awareness copy, not announcement copy. **The catering earn RATE is still unconfirmed** —
state no catering-specific rate and do no arithmetic depending on one.

**The weekly cross-promo strip is retired.** The pink P.S. band ("Tuesdays 2x Crazy Points,
Thursdays the craft drink rides free, Saturdays it's queso") comes out of Family Night send 7
and goes into no send after it. Do not carry it forward when building from an older file —
templates get copied forward, which is exactly how a retired block survives its own retirement.

---

## Never invent a number

No loyalty rate, reward value, price, end date, percentage or count that you were not given.
If the strongest line available depends on an unknown, **write the file without it and flag the
unknown as a blocker.** Say what the line would be and what you need to write it.

This has come up repeatedly and it is the single easiest way to ship something false.

---

## Copy: what makes a promo email work

**Lead with the prize, not the mechanism.** The most common failure in this repo: headline,
subhead, body and CTA are all operating instructions while the reward sits below the fold after
the CTA. Nobody reads the rules of a game they haven't decided they want to play. The email's
job is three answers — what do I get, what do I do, why now. The landing page does rules.

**Body copy: 90–130 words.** If you are at 250, the cut list is almost certainly: a throat-clear
opener ("here's the whole thing in one breath"), a worked example that belongs next to the
graphic it explains, and terms copy sitting under the CTA.

**Never let terms be the last thing read before the button.** Limitations under a CTA depress
the click. Move them into the body next to where they bite, or into the legal block.

**Kill defensive copy in the promise slot.** A line that pre-empts an objection nobody has
raised reads as protesting too much — especially stated three times. And beware negations:
"no luck involved" keeps "luck" alive in the reader's head while removing the anticipation a
game is supposed to offer. State the underlying fact positively, as agency, once:
"Your order picks your card."

**Write urgency you actually have.** Check the dates. If a qualifying window opened before the
send date, a large share of the list is already holding something playable — "you might already
have one, check your pocket" is free, true, and beats any manufactured deadline.

**Voice:** short declarative sentences, confident, dry, a little swagger. Never corny, never
exclamation-heavy. Liked headlines: "STAY PUT." / "Dinner comes to the window." · "50 POINTS." /
"Already in your account." · "Pour decisions." · "Get cracking."

**Do not re-caveat a standing offer.** Carry it verbatim — same threshold, code, terms and
channels. Elle owns the offer; the email applies it.

**Do not silently recase or reword supplied copy.** If Elle wrote "Tis the Season", it ships as
"Tis the Season". Fixing an apostrophe without saying so costs trust.

---

## Behavioural levers worth knowing (with real sources)

- **Endowed progress** — Nunes & Drèze 2006, *JCR*: an 8-stamp card completed at 19%; a
  12-stamp card with 2 pre-filled, identical real requirement, completed at **34%**. For any
  collect-a-set promo, give the first item free, framed as a head start on the full set, never
  as a shorter set. The inflated goal is the whole mechanism.
- **Goal gradient** — Hull 1932; Kivetz, Urminsky & Zheng 2006, *JMR*. Effort accelerates near
  the goal, but only if the guest can SEE where they are. A static reference chart shows the
  map, not the position. Personalize progress in follow-up sends.
- **Progress framing** — Koo & Fishbach 2008/2012: when commitment is low, emphasize what's
  ACCUMULATED ("you already have one"); when established, emphasize what REMAINS ("two to go").
- **Implementation intentions** — Gollwitzer & Sheeran 2006 meta-analysis, d ≈ .65 across 94
  studies. Name ONE next action tied to ONE occasion: "Next visit, add a drink." Five
  simultaneous goals is not a plan.
- **Zero as a special price** — Shampanier, Mazar & Ariely 2007, *Marketing Science*. "Free"
  motivates disproportionately to its economic value. Use the word.
- **Social loafing** — Karau & Williams 1993, *JPSP*. Effort collapses when a contribution is
  unidentifiable and dispensable. A single anonymous receipt on a 15-store leaderboard is both.
  Store-vs-store competition motivates STAFF (real teammates, real influence), not guests.
- **Fluency and trust** — Oppenheimer 2006. Needless complexity lowers perceived competence.
  A dense terms block signals "we are protecting ourselves from you."
- **Concealment is punished more than disclosure** — John, Barasz & Norton 2016, *PNAS*.
  Burying a real restriction costs more trust than stating it plainly.

**Treat with caution:** the Zeigarnik effect (inconsistent replication), loss-aversion magnitude
(Gal & Rucker 2018 contest the ~2×), endowment on un-earned virtual goods (no clean field
replication), choice overload (Scheibehenne et al. 2010 meta-analysis finds ~zero). Do not cite
a benchmark completion rate for a restaurant promo — reliable figures do not exist; say so.

---

## Promo legal (US, Missouri + Illinois)

Not legal advice — a compliance read good enough to redline copy with. Flag anything at the
edge for actual counsel.

**The lottery test.** An illegal private lottery needs all three: **prize + chance +
consideration**. Knock out one and it is lawful. Mo. Rev. Stat. § 572.010; 720 ILCS 5/28-2(b).
A promo where a purchase deterministically decides the outcome has prize + consideration but NO
chance — that is a purchase-incentive program, legally a punch card. No AMOE, no "no purchase
necessary", no odds disclosure.

**What breaks it:** any randomization, throttling, supply limit, or "first N per store" reentering
the award path. Then you have three elements and a purchase requirement, and you need a genuine
free alternate entry route stated in the email. Always ask: *is any outcome here decided by
anything other than a published rule?*

**A secondary prize is a separate animal.** A side drawing attached to a deterministic promo can
be an illegal lottery on its own. Ask how the winner is chosen and whether a purchase is
required to be in the pool, before the email describes it.

**No state registration** applies in MO/IL — only NY and FL (ARV over $5,000) and RI (retail
over $500).

**"Free to play" on top of a purchase requirement** is the FTC Free Goods fact pattern
(16 CFR 251). Write "Purchase required."

**A promotion must state its END DATE.** This is the defect that recurs. An offer with reward
expiry and per-season limits but no closing date is an open-ended offer you later close — a
classic state-AG complaint pattern under the Missouri Merchandising Practices Act (§ 407.020)
and the Illinois Consumer Fraud Act (815 ILCS 505). If you do not have the date, put a
**visible placeholder** in the copy so it cannot ship unnoticed. Do not smooth it over.

**AI character disclosure.** A mascot needs none — nobody discloses that Tony the Tiger isn't a
tiger. The rules that bite (16 CFR 255 Endorsement Guides; 16 CFR 465 Fake Reviews, 2024) reach
product claims in a first-person voice. An announcer announcing is safe; a synthetic character
saying "I tried it and it's the best thing on the menu" is not — and the fix there is to delete
the copy, not add a disclaimer. Where a disclosure is used, FTC doctrine is built on
**proximity**: put it next to the claim, not in the footer. Separately: if a synthetic voice
imitates an identifiable real person, disclosure does not cure it — Illinois' Right of Publicity
Act (765 ILCS 1075) covers voice expressly. Get a license and confirm the TTS vendor permits
commercial advertising use.

**Trademark.** Generic sports vocabulary is clean. Specific bowl names (Rose, Sugar, Cotton) and
"Super Bowl"/"Big Game" are policed hard. Real exposure is usually art direction — team colour
combinations, helmets, logos, trophy silhouettes — not copy. A disclaimer does not cure
infringing use, so its value is deterrence, not protection; eight words is plenty.

**Triage the fine print, don't just shorten it.** Terms that CHANGE BEHAVIOUR get promoted into
the body next to where they bite (expiry, account-linking requirements, one-per-receipt limits,
"not every X qualifies"). Boilerplate (no cash value, non-transferable, channel lists,
fulfilment timing) goes to the rules page behind a prominent link. Put a plain-English summary
line on top of whatever remains. 200 words of undifferentiated block → ~90 words with MORE
effective coverage.

**Account-linking requirements are a silent conversion cliff.** If the body promises rewards
"load to your account" and only the footer says you must LINK one, guests hit a wall they were
never warned about. Promote it into the story.

---

## Accessibility (non-negotiable)

- Semantic headings. A 40px styled `<p>` doing a heading's job fails WCAG 1.3.1 and a screen
  reader skips it. Check the outline reads as a sensible document.
- `a:focus { outline: 3px solid <brand>; outline-offset: 3px }`. The UA default vanishes on
  saturated buttons, and view-in-browser is a real browser (2.4.7). Word ignores `:focus`.
- Alt text describes the image AND any text baked into it. Decorative dividers get
  `aria-hidden`.
- Contrast: 4.5:1 normal text, 3:1 large. Decorative elements are exempt once `aria-hidden`.
- An infinitely looping GIF has no pause mechanism and `prefers-reduced-motion` cannot reach it
  (WCAG 2.2.2). Strip the NETSCAPE2.0 loop block — 19 bytes, preserves every pixel and the
  original compression.
- `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important } }`
- Motion must be transform-only; Gmail and Outlook render frame zero forever, so frame zero has
  to read on its own.

---

## Working rules

- **A new campaign is a NEW file.** Never modify a send that has been signed off. If a finished
  file needs changing, say so and ask first.
- **Build gates before trusting them.** Every check must be proven to FAIL on known-bad input
  before its pass is worth anything. A lint blind to a class reads as a pass, which is worse
  than no lint. When a template adds a display class, add it to `lint-word.js` in the same commit.
- **`grep -c` counts LINES, not occurrences** — useless on minified single-line ESP output.
  Use `grep -o … | wc -l`.
- Document every file with a header comment explaining WHY each defence exists and what broke
  without it. `strip.js` removes these from the paste build.
- Record open questions in that header as numbered blockers, so they survive the conversation.

## Typography the gate can see, and what it could not

**Orphans are checked on centred text of any size AND on left-aligned type at 18px or
larger.** The gate originally checked centred blocks only; a Gmail screenshot of a real send
showed a left-aligned subhead wrapping to three lines and ending on one word, invisible to
every check. The 18px floor keeps body copy out - a long paragraph ending short is ordinary
typography, a display line ending on one word is a defect.

**Fix an orphan by binding the tail with `&nbsp;`, never by rewording until it fits.**
Rewording moves the break to a different width; binding holds at every width. Bind the whole
phrase rather than two words of it - binding `bowl or&nbsp;wrap` fixed 414px and broke 600px,
because it only relocated the break. Keep a bound phrase under ~24 characters at display
size, or it becomes a min-content floor that stops the shell shrinking at 320px.

**A screenshot from a real inbox is worth running the numbers on**, even when it shows an old
draft. Check first whether the render matches the build you delivered - grep the visible
strings against the paste build - and say so if it does not. Then measure the current build at
the same widths anyway: the layout defect is usually still there even when the copy has moved
on.

## Verify before delivering. Always. This is not optional.

Emails are read late — days after the send, from a promotions tab, forwarded. **Every claim
must be true for the whole time the email is readable, not just on send day.**

Run `node dates.js <paste-build>` (wired into `check.js` as the `dates` stage) and, for anything
non-trivial, also run an independent **verification agent** over the paste build before
delivering. The agent's brief:

1. **Temporal decay** — for every date, weekday, duration and relative time, state what it
   resolves to on send day and four days later, and whether it becomes false. A bare weekday
   with no date anchor is the classic defect: "Receipts from Sunday count" is correct on the
   send date and wrong for anyone opening it the following Monday. Verify calendar facts with
   the `date` command; do not reason about what day a date falls on.
2. **Internal contradictions** — does the marketing body agree with the legal block on every
   shared fact? Receipt windows, expiry, what is required to get a reward, counts.
3. **Arithmetic and counts** — do stated numbers agree with each other and with the graphics?
   Do alt texts match the labels they describe?
4. **Unsupported claims** — anything asserted with no source: a rate, a value, a price, a
   superlative, a location count.
5. **Links** — every href and mailto, all UTMs naming the same campaign, no anchor text that
   contradicts its destination.
6. **Removed copy has not crept back** — check by explicit string search, not by reading.

Report defects only, most severe first, each marked SHIP-BLOCKER / SHOULD-FIX / NOTE.

**Never report a verification you did not just run.** Same rule as the gate.

## The advisory council

When a send is high-stakes, or when the client says it is not working and cannot say why, run
four parallel reviews and synthesize: **direct-response strategy** (is the prize in the desire
slot?), **behavioural science / game design** (does the mechanic actually drive the behaviour?),
**copy and voice** (rewrite, don't theorize), **promo compliance** (what must stay, what moves
to the rules page).

Report disagreements between them honestly rather than averaging them into mush, and make a
call. Give reasons, sources and confidence scores, and separate settled law and replicated
findings from judgment calls.

## Delivering

Reasons, sources, confidence scores. Distinguish what you verified from what you assumed. If
something is blocked on a human answer, list it as a blocker with the specific question — do not
guess and do not bury it. Then paste the HTML.

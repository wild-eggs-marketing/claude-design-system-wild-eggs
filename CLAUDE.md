# Working agreements for this repo

## Emails: the HTML TXT goes inline in chat. Always. Every time.

Any reply that delivers or revises an email MUST include the full final HTML inline in the chat
message, in one ```html fenced code block, ready to copy straight into Paytronix Source view.

- Not a file path. Not an attachment alone. Not a summary of what changed. Not an excerpt.
- The whole file, in the message, in a code block.
- Attachments and screenshots are ADDITIONAL, never a substitute.
- Length is never a reason to skip it or truncate it.
- Paste the `.PASTE.html` build (documentation comments stripped by
  `tools/email-render-gate/strip.js`), because that is what actually goes into Paytronix.

This applies to drafts, revisions and one-line copy fixes equally, not only to finished sends.
If a reply about an email does not contain that code block, the reply is not done.

Full detail: `claude/skills/promo-email-loop.md`, RULE ZERO.

## Emails: run the gate before delivering. One command, no exceptions.

    cd tools/email-render-gate && node check.js ../../emails/<name>.html

`check.js` builds the six client variants and runs every gate in order — geometry, specificity,
orphans, source lint — then regenerates the `.PASTE.html` build and proves master and paste
render identically. It exits non-zero if anything fails.

- Run it on the MASTER file. The paste build is generated, never hand-edited.
- Green is the precondition for delivering. If it fails, the email is not ready — say so.
- Never report a gate result you did not just run. "It passed last time" is not a pass.

Four finished sends shipped with the display-type upgrade silently losing, because each gate
was run once on the day it was written and never again. One command exists so that cannot
happen twice.

## Emails: display type — the `@media screen` upgrade needs `!important`

The Word-safe architecture puts the SMALL size inline and scales UP inside `@media screen`,
because Word never reads a media query. That only works if the class rule wins, and **an inline
`font-size` beats a class rule — media query or not — unless the rule carries `!important`.**

- Every declaration in a display-type upgrade block carries `!important`.
- Word never reads `@media`, so `!important` in there cannot reach Outlook Classic. It is safe.
- Adding it is not a one-line fix: letting the upgrade through raises the REAL rendered size,
  which can then overflow its cell or collide with its neighbour. Re-measure with
  `node measure.js` and re-run the gate. Thursday needed `line-height` 0.92 → 1 the moment the
  upgrade started winning.

## Emails: preview text — check which ESP you are sending from

**Paytronix** has no preview-text field and takes inbox preview from `<title>`. In a Paytronix
send, `<title>` must carry the PREHEADER COPY, identical to the hidden preheader div, never a
page-title string — Paytronix can surface `<title>` as visible copy at the top of the email,
where a page title reads as a mistake.

**Toast** has a dedicated preview-text field. In a Toast send, put the preview copy in that
field and let `<title>` be a real page title: it is what the view-in-browser page shows in the
tab and what a screen reader announces on load (WCAG 2.4.2 Page Titled), and a marketing
sentence makes a poor one.

Either way the hidden preheader div stays, and it must match whatever the ESP will actually
show, so the two can never disagree in a client that falls back to body text. Every Wild Eggs
and CBW file written before 2026-09-22 assumed Paytronix; check before reusing one on Toast.

## Don't edit a send that is already finished

A new campaign is a NEW file. When the ask is "a new email for X," build a net-new file rather
than modifying a send that has been signed off. If a finished file needs changing, say so and
ask first.

## Don't re-caveat a standing offer

When an offer is carried over from a previous send, carry it verbatim: same threshold, same code,
same terms, same channels. Do not rescope it, do not add hedges about whether it applies, do not
re-derive its fine print. Elle owns the offer; the email applies it.

## Catering orders DO earn Crazy Points. They always have.

Confirmed by Elle, 2026-09-23. This is a standing brand fact, not a campaign detail.

- **Never write copy stating or implying that catering does not earn points.** The Labor Day
  catering send shipped "Catering orders don't earn Crazy Points." in its legal block. That line
  was wrong when it went out. That file is not in this repo — it lives wherever Elle keeps sent
  Paytronix campaigns — so the risk is a human pasting it back in as a reference. If a pasted
  reference file carries that line, delete it before building anything from it.
- **Never frame catering earning as new.** No "now earns", no "finally", no "from here on".
  It has always been true; most guests simply never knew, which is a marketing failure and not
  a program change. Write awareness copy, not announcement copy.
- **The catering earn RATE is still unconfirmed.** The core menu is $1 = 1 point, 200 points =
  a free meal. Nobody has said whether catering earns at that same rate. Do not state a catering
  rate, and do not do arithmetic that depends on one — "you're $150 of catering from a free meal"
  is the strongest line available and it stays unwritten until someone confirms the rate.
- Points are attached at order time. An order placed without a Crazy Points account on it cannot
  earn, and points cannot be added afterwards. That part is safe to state.

## Build gates before trusting them

Every check in `tools/email-render-gate/` must be proven to FAIL on known-bad input before its
pass is worth anything. A lint that is blind to a class reads as a pass, which is worse than no
lint. When a template adds a display class, add it to `lint-word.js` in the same commit.

## The weekly cross-promo strip is retired

The pink P.S. band — "Tuesdays 2x Crazy Points, Thursdays the craft drink rides free, Saturdays
it's queso" — comes out of Family Night send 7 and does not go into any send after it. The weekly
program is being replaced by the bowl games promo.

- Do not carry it forward when building a new send from an older file. Templates are copied
  forward, which is exactly how a retired block survives its own retirement.
- Finished sends that already shipped with it stay as they are. This is a rule about what goes
  out next, not a reason to edit a send that is done.
- When the bowl games promo lands it gets its own block, written for it. Do not reuse this strip
  with the copy swapped: its three-day rhythm is the old program's shape.

## Toast rebuilds the email. Conditional comments do not survive it.

Measured against the campaign Toast actually sent on 2026-09-22, by diffing its output
against the file that was pasted in. Toast's campaign builder does NOT paste raw HTML: it
parses the source into its own block model and re-emits the email through MJML (fingerprints
in the sent output: `mj-outlook-group-fix`, `mj-column`, `[if lte mso 11]`).

**Destroyed, every time:**
- Every conditional comment. 4 `<v:roundrect>` in, 0 out. The `[if mso]` font stylesheet and
  the ghost table go with them. This is not a sanitizer a sender can dodge by re-pasting —
  it is how the builder works. "Paste it again and grep for roundrect" was advice that could
  never have worked, and it was given twice.
- `<title>`: Toast replaces it with the campaign subject line.

**Appended, every time:** `font-weight:normal` at the END of every heading element's inline
style. It lands last in the declaration block, so it beats an earlier `font-weight:900` and
the headline renders at 400. Eight headings in, eight injections out. Non-heading elements
are untouched, which is why `<div>` display lines kept their weight while the `<h2>`s did not.

**Survives:** the `<style>` block, classes, aria attributes, inline styles, `white-space`
spans, `[data-ogsc]` rules.

**Therefore, for any Toast send:**
- Headings carry `font-weight:900 !important` AND wrap their text in a span that carries the
  weight itself. `!important` handles Toast; the span means the defence does not depend on
  `!important` surviving the Word engine, where support is inconsistent.
- Buttons put their padding on the CELL via `mso-padding-alt`, never only on the anchor.
  With the VML twin gone there is nothing else holding the box open in Outlook Classic.
- Do not spend effort on `<title>`; Toast overwrites it.
- `node check.js` runs a `toast` stage that models all of this. It is scoped to
  `data-brand="wild-eggs"` and skips CBW, because Paytronix's behaviour has NOT been
  measured. Do not extend it to CBW on the assumption that the two behave alike.

The gate models the Word engine and six clients and modelled ZERO ESPs until now. Every
defect that reached an inbox in this campaign happened downstream of the gate. "Green across
every client" means green *before the ESP touches it*; say that, or say nothing.

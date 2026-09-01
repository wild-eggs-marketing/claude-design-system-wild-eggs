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

## Emails: the preheader matches the `<title>` tag word for word

Paytronix takes inbox preview text from `<title>`. It must carry the PREHEADER COPY, identical to
the hidden preheader div, never a page-title string — Paytronix can surface `<title>` as visible
copy at the top of the email, where a page title reads as a mistake.

## Don't edit a send that is already finished

A new campaign is a NEW file. When the ask is "a new email for X," build a net-new file rather
than modifying a send that has been signed off. If a finished file needs changing, say so and
ask first.

## Don't re-caveat a standing offer

When an offer is carried over from a previous send, carry it verbatim: same threshold, same code,
same terms, same channels. Do not rescope it, do not add hedges about whether it applies, do not
re-derive its fine print. Elle owns the offer; the email applies it.

## Build gates before trusting them

Every check in `tools/email-render-gate/` must be proven to FAIL on known-bad input before its
pass is worth anything. A lint that is blind to a class reads as a pass, which is worse than no
lint. When a template adds a display class, add it to `lint-word.js` in the same commit.

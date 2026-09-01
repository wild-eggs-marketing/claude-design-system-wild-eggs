# Email Render Gate

Render gate for Paytronix HTML emails. Same "render before review" discipline as
`promo-chat-gate`, pointed at an email instead of a React component.

It builds four client variants from one source file, renders each in headless
Chromium at real viewport widths, and asserts **geometry** rather than reading the
source.

## Why it exists

The Family Night template shipped to Outlook Classic with four separate bugs that
every source review missed. The CFO's screenshots caught them in production. None
of them are visible in the markup; all of them are obvious in a bounding box.

## Run

    cd tools/email-render-gate
    npm i --no-audit --no-fund playwright-core
    mkdir -p site
    # drop placeholder images into site/ sized to the real photos, then:
    node build.js ../../emails/<file>.html
    node verify.js

## The four variants

| variant | stands in for |
|---|---|
| `modern.html` | Apple Mail, iOS Mail, Gmail app + web, Outlook.com, Outlook for Mac, Yahoo, Samsung, Thunderbird |
| `word.html` | **Outlook Classic on Windows** (2007-2024 and classic M365) |
| `gmail.html` | Gmail's extra property stripping |
| `noimg.html` | images blocked, the default first-open state in most corporate inboxes |

## The Word transform

Outlook Classic renders with the **Word** engine. `build.js` applies its documented
behaviours in order:

1. `@media` blocks are never read → every `@media` block is stripped
2. `<!--[if mso]>` content **is** read → unwrapped into live markup
3. no webfonts → the Google Fonts link is removed and the first family in each
   stack is forced to resolve to a serif, modelling Windows font substitution
4. no `display:inline-block` → stripped
5. no padding on inline elements → `padding` stripped from every `<a>` style
6. no `border-radius`, `object-fit`, `max-width`, or CSS animation

Sources: caniemail.com per-property Outlook Windows data, and Microsoft's Word
HTML rendering guidance for Outlook 2007+.

## What it asserts

- **no horizontal overflow** at 320 / 360 / 375 / 414 / 600 / 900
- **the shell stays at 600px** — Word blew it to ~870px on the last send
- **display type never collides with its neighbours** — the load-bearing one.
  `line-height` below 1 makes Word clip the line box while the glyphs keep full
  height, so caps bleed upward into whatever sits above. This is what put
  "UNDEFEATED." through the Family Night bar. A source review cannot see it; a
  bounding-box gap test can.
- **every CTA keeps its padding** — the cell must be at least 12px taller than its
  text, and at least 40px for a tap target. Catches padding declared on the anchor,
  which Word silently drops.
- **images keep their native aspect ratio** — Word ignores `object-fit` but obeys
  `height`, so a fixed height on a differently-shaped photo squashes it.
- no JS errors, on every variant.

## The min-content trap

Any **fixed length** on a nested element becomes a min-content floor for the entire
email, and no amount of `width:100% !important` on the outer shell can release it.
Two instances were pinning this template:

- `max-width:600px` on a full-bleed image → 600px floor
- `width:594px` on the two-column panel's table → 600px floor
- `width:360px` on the ribbon → the long-unexplained ~340-360px floor that made
  every send on this template scroll sideways at 320px

Percentage lengths contribute zero. Use `max-width:100%` on images, and release any
fixed-width nested table inside the mobile media query.

## Adding an assertion

Add to `OVERLAP_PAIRS` for a new pair that must never touch, or extend the `geom()`
evaluate block. Assert geometry, never source text.

## What this gate cannot do

There is no Word engine on Linux. `word.html` is a **simulation** built from the
documented behaviour list, not a real Outlook render, and `Impact` is not installed
here so the display fallback renders as Arial. It reliably catches layout collapse,
collisions, and overflow. It does not replace a Litmus or Email on Acid run before a
large send, and it cannot confirm exact Windows font metrics.

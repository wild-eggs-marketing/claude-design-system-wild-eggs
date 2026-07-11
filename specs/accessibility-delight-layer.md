# Accessibility + Delight Layer — "The Crazy Dial"

**Status:** v1 shipped to Framer project (Crazy Bowls V1) · 2026-07-11
**Framer code file:** `CrazyDial.tsx` (source mirrored in `framer-components/CrazyDial.tsx`)
**Placed on:** Home page (`/`). Roll out to remaining pages (or into the Navbar component) after the Quiz Your Crazy thread lands, to avoid edit collisions.

## Concept

Accessibility and delight are one control, not two features. A floating dial asks
the most on-brand question possible: **"How crazy should this website be?"**

| Mode | What it does |
|---|---|
| **Calm** | All animation/transitions off site-wide, no smooth scroll. The accessibility mode, without clinical framing. |
| **Classic** | House default. "A little bit crazy." |
| **Certifiable** | Delight layer ON: click sprinkles in brand colors, button hover jiggle, lime text selection, and a `crazy`-typed easter egg (ingredient emoji rain). |

Plus three readability switches, honestly labeled:
- **Bigger everything** — 15% zoom on the whole site
- **Underline links** — "Links stop hiding."
- **Bold focus outlines** — dragonfruit 3px `:focus-visible` rings (default ON)

## Accessibility guarantees

- `prefers-reduced-motion` users default to **Calm** on first visit.
- Preferences persist in `localStorage` (`cb-crazy-dial`) across visits.
- Injected **skip-to-content link** — first tab stop on every page carrying the dial, focuses `<main>`/first `h1`.
- Panel: `role="dialog"`, radio-group semantics, `aria-expanded` trigger, Escape closes and returns focus, `aria-live` announcements on every change.
- Delight never fires in inputs/textareas, is rate-limited, and is fully disabled in Calm mode.
- Trigger is a 56px target with a mode-colored dial glyph (teal/lime/dragonfruit) whose needle physically rotates to the chosen mode.

## Implementation notes

- One self-contained code component; injects a single managed `<style id="cb-crazy-dial-styles">` into `<head>` — no other components touched.
- Sprinkles/emoji use the Web Animations API on throwaway DOM nodes (no canvas, no deps, auto-cleanup).
- Canvas render target shows a static preview; no document mutation in the Framer editor.
- Known cosmetic quirk: Framer pins the canvas wrapper at arbitrary coordinates; irrelevant at runtime because the component renders `position: fixed` bottom-left.

## v1.1 — WCAG AA fixes (2026-07-11)

Self-audit found four gaps; all fixed in Framer + this mirror:

1. **Contrast (1.4.3/1.4.11):** lime (`163,191,30`) is ~2.1:1 on white — replaced with
   Lime Deep (`123,144,21`, ~4.9:1) for all text/glyph uses; dial glyph is now ink on the
   lime trigger background (~7:1). Lime remains as background fill only.
2. **Fake radios (4.1.2):** mode buttons no longer claim `role="radio"` without arrow-key
   behavior — now `aria-pressed` toggle buttons in a labeled `role="group"`.
3. **Focus order (2.4.3):** the dialog receives focus on open (`tabIndex={-1}` + focus()),
   so Tab proceeds through its controls; Escape still returns focus to the trigger.
4. **Small print (1.4.3):** hint/blurb text opacity raised 0.65 → 0.8; unselected borders
   0.25 → 0.35 alpha.

## Next steps

1. Move instance into the shared Navbar component for site-wide coverage (after quiz thread merges).
2. `accessibility-audit` + `polish-pass` skills over the live staging URL.
3. Certifiable-mode delight bank v2: squiggle underline draw-ins on H1/H2, doodle proximity wiggle, seasonal sprinkle palettes.

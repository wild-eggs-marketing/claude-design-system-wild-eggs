// Mirror of Framer code file CrazyDial.tsx (project: Crazy Bowls V1)
// Canonical copy lives in the Framer project; keep this in sync when editing there.

import { useState, useEffect, useCallback, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { motion, AnimatePresence } from "framer-motion"

// ---------- Brand tokens ----------
const C = {
    cream: "rgb(255, 242, 230)",
    ink: "rgb(28, 43, 28)",
    green: "rgb(18, 58, 20)",
    lime: "rgb(163, 191, 30)",
    limeDeep: "rgb(123, 144, 21)", // 4.9:1 on white — use for text/glyphs where lime fails contrast
    dragonfruit: "rgb(218, 45, 101)",
    apricot: "rgb(242, 119, 78)",
    teal: "rgb(13, 79, 79)",
    yellow: "rgb(246, 192, 52)",
    white: "rgb(255, 255, 255)",
}

type Mode = "calm" | "classic" | "certifiable"
type Prefs = {
    mode: Mode
    bigText: boolean
    underlineLinks: boolean
    strongFocus: boolean
}

const DEFAULT_PREFS: Prefs = {
    mode: "classic",
    bigText: false,
    underlineLinks: false,
    strongFocus: true,
}

const STORAGE_KEY = "cb-crazy-dial"
const STYLE_ID = "cb-crazy-dial-styles"
const SKIP_ID = "cb-skip-link"

const MODE_COPY: Record<Mode, { label: string; blurb: string }> = {
    calm: { label: "Calm", blurb: "Motion off. Easy on the eyes. Still delicious." },
    classic: { label: "Classic", blurb: "A little bit crazy. The house default." },
    certifiable: { label: "Certifiable", blurb: "Maximum crazy. You were warned." },
}

// ---------- Document-level CSS ----------
function buildCss(p: Prefs): string {
    let css = ""
    if (p.mode === "calm") {
        css += `
*, *::before, *::after {
  animation-duration: 0.001s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001s !important;
}
html { scroll-behavior: auto !important; }
video { animation: none !important; }
`
    }
    if (p.bigText) {
        css += `body { zoom: 1.15; }\n`
    }
    if (p.underlineLinks) {
        css += `a, a * { text-decoration: underline !important; }\n`
    }
    if (p.strongFocus) {
        css += `
:focus-visible {
  outline: 3px solid ${C.dragonfruit} !important;
  outline-offset: 3px !important;
  border-radius: 4px;
}
`
    }
    if (p.mode === "certifiable") {
        css += `
@keyframes cb-jiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-1.5deg) scale(1.02); } 75% { transform: rotate(1.5deg) scale(1.02); } }
a:hover, button:hover { animation: cb-jiggle 0.35s ease-in-out; }
::selection { background: ${C.lime}; color: ${C.ink}; }
`
    }
    return css
}

function applyPrefs(p: Prefs) {
    if (typeof document === "undefined") return
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!el) {
        el = document.createElement("style")
        el.id = STYLE_ID
        document.head.appendChild(el)
    }
    el.textContent = buildCss(p)
}

// ---------- Click sprinkles (certifiable mode) ----------
const SPRINKLE_COLORS = [C.lime, C.dragonfruit, C.apricot, C.yellow, C.teal]
function spawnSprinkles(x: number, y: number) {
    if (typeof document === "undefined") return
    for (let i = 0; i < 8; i++) {
        const d = document.createElement("div")
        const size = 5 + (i % 3) * 2
        d.setAttribute("aria-hidden", "true")
        d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:${i % 3 === 0 ? "2px" : "50%"};background:${SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]};pointer-events:none;z-index:99999;`
        document.body.appendChild(d)
        const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.6
        const dist = 34 + Math.random() * 30
        d.animate(
            [
                { transform: "translate(0,0) scale(1)", opacity: 1 },
                { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 20}px) scale(0.3)`, opacity: 0 },
            ],
            { duration: 550 + Math.random() * 250, easing: "cubic-bezier(0.2,0.6,0.4,1)" }
        ).onfinish = () => d.remove()
    }
}

// ---------- Bowl rain easter egg (type "crazy") ----------
const BOWL_EMOJI = ["🥗", "🌶️", "🥑", "🍤", "🔥", "🥢"]
function bowlRain() {
    if (typeof document === "undefined") return
    for (let i = 0; i < 24; i++) {
        const d = document.createElement("div")
        d.textContent = BOWL_EMOJI[i % BOWL_EMOJI.length]
        d.setAttribute("aria-hidden", "true")
        d.style.cssText = `position:fixed;left:${Math.random() * 100}vw;top:-40px;font-size:${22 + Math.random() * 18}px;pointer-events:none;z-index:99999;`
        document.body.appendChild(d)
        d.animate(
            [
                { transform: "translateY(0) rotate(0deg)", opacity: 1 },
                { transform: `translateY(${window.innerHeight + 80}px) rotate(${Math.random() > 0.5 ? "" : "-"}300deg)`, opacity: 0.9 },
            ],
            { duration: 2200 + Math.random() * 1600, delay: Math.random() * 900, easing: "cubic-bezier(0.3,0,0.6,1)" }
        ).onfinish = () => d.remove()
    }
}

/**
 * CRAZY DIAL — accessibility + delight layer for the whole site
 *
 * Pick how crazy the website behaves (Calm / Classic / Certifiable) plus
 * readability switches. Persists per visitor, respects
 * prefers-reduced-motion, injects a skip-to-content link.
 *
 * Placement: "inline" sits in a layout (e.g. the Navbar) and the panel drops
 * down below the trigger; "floating" fixes the dial to a viewport corner.
 *
 * @framerIntrinsicWidth 44
 * @framerIntrinsicHeight 44
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function CrazyDial(props: any) {
    const { corner = "bottom-left", placement = "floating" } = props
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const inline = placement === "inline"

    const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
    const [open, setOpen] = useState(false)
    const [announce, setAnnounce] = useState("")
    const panelRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const keyBuffer = useRef("")

    // Load prefs; default to Calm for prefers-reduced-motion users
    useEffect(() => {
        if (typeof window === "undefined" || isCanvas) return
        let loaded: Prefs | null = null
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            if (raw) loaded = { ...DEFAULT_PREFS, ...JSON.parse(raw) }
        } catch (e) {}
        if (!loaded && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            loaded = { ...DEFAULT_PREFS, mode: "calm" }
        }
        if (loaded) setPrefs(loaded)
    }, [isCanvas])

    // Apply prefs to document + persist
    useEffect(() => {
        if (isCanvas) return
        applyPrefs(prefs)
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
        } catch (e) {}
    }, [prefs, isCanvas])

    // Move focus into the dialog when it opens (WCAG 2.4.3)
    useEffect(() => {
        if (!open || isCanvas) return
        panelRef.current?.focus()
    }, [open, isCanvas])

    // Skip-to-content link (prepended to body so it's the first tab stop)
    useEffect(() => {
        if (typeof document === "undefined" || isCanvas) return
        if (document.getElementById(SKIP_ID)) return
        const a = document.createElement("a")
        a.id = SKIP_ID
        a.href = "#"
        a.textContent = "Skip to content"
        a.style.cssText = `position:fixed;left:12px;top:-60px;z-index:100000;background:${C.green};color:${C.white};font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:16px;padding:12px 20px;border-radius:999px;text-decoration:none;transition:top 0.2s ease;`
        a.addEventListener("focus", () => (a.style.top = "12px"))
        a.addEventListener("blur", () => (a.style.top = "-60px"))
        a.addEventListener("click", (e) => {
            e.preventDefault()
            const main = document.querySelector("main") || document.querySelector("h1")
            if (main) {
                ;(main as HTMLElement).setAttribute("tabindex", "-1")
                ;(main as HTMLElement).focus({ preventScroll: false })
                main.scrollIntoView({ behavior: "auto", block: "start" })
            }
        })
        document.body.prepend(a)
        return () => a.remove()
    }, [isCanvas])

    // Certifiable delight: click sprinkles + "crazy" easter egg
    useEffect(() => {
        if (typeof document === "undefined" || isCanvas || prefs.mode !== "certifiable") return
        let last = 0
        const onClick = (e: MouseEvent) => {
            const now = Date.now()
            if (now - last < 250) return
            last = now
            const t = e.target as HTMLElement
            if (t.closest("input, textarea, select, [data-cb-dial]")) return
            spawnSprinkles(e.clientX, e.clientY)
        }
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement
            if (t.closest("input, textarea, select, [contenteditable]")) return
            keyBuffer.current = (keyBuffer.current + e.key.toLowerCase()).slice(-5)
            if (keyBuffer.current === "crazy") {
                bowlRain()
                keyBuffer.current = ""
            }
        }
        document.addEventListener("click", onClick)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("click", onClick)
            document.removeEventListener("keydown", onKey)
        }
    }, [prefs.mode, isCanvas])

    // Close on Escape, return focus to trigger
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false)
                triggerRef.current?.focus()
            }
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [open])

    // Inline mode: close when clicking outside the widget
    useEffect(() => {
        if (!open || !inline || typeof document === "undefined") return
        const onDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (!t.closest("[data-cb-dial]")) setOpen(false)
        }
        document.addEventListener("mousedown", onDown)
        return () => document.removeEventListener("mousedown", onDown)
    }, [open, inline])

    const setMode = useCallback((mode: Mode) => {
        setPrefs((p) => ({ ...p, mode }))
        setAnnounce(`${MODE_COPY[mode].label} mode on. ${MODE_COPY[mode].blurb}`)
    }, [])

    const toggle = useCallback((key: keyof Prefs, label: string) => {
        setPrefs((p) => {
            const v = !p[key]
            setAnnounce(`${label} ${v ? "on" : "off"}`)
            return { ...p, [key]: v }
        })
    }, [])

    const font = "'Bricolage Grotesque', sans-serif"
    const display = "'Passion One', sans-serif"

    const isLeft = corner.includes("left")
    const anchor: any = inline
        ? { position: "relative", zIndex: 9999, width: "fit-content", height: "fit-content" }
        : {
              position: isCanvas ? "relative" : "fixed",
              bottom: isCanvas ? undefined : 20,
              [isLeft ? "left" : "right"]: isCanvas ? undefined : 20,
              zIndex: 9999,
          }

    // Panel opens downward when inline (navbar), upward when floating (corner)
    const panelPos: any = inline
        ? { top: "calc(100% + 12px)", [isLeft ? "left" : "right"]: 0 }
        : { bottom: isCanvas ? undefined : 72, [isLeft ? "left" : "right"]: 0 }

    const triggerSize = inline ? 44 : 56
    const glyphSize = inline ? 24 : 28

    // Accent per mode — text-safe colors (>= 4.5:1 on white/cream)
    const modeAccent: Record<Mode, string> = {
        calm: C.teal,
        classic: C.limeDeep,
        certifiable: C.dragonfruit,
    }

    // Trigger background per mode; glyph color chosen for >= 3:1 on that background
    const triggerBg = prefs.mode === "certifiable" ? C.dragonfruit : prefs.mode === "calm" ? C.teal : C.lime
    const glyphColor = prefs.mode === "classic" ? C.ink : C.white

    const checkboxRow = (key: keyof Prefs, label: string, hint: string) => (
        <label
            key={key}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "8px 0" }}
        >
            <input
                type="checkbox"
                checked={prefs[key] as boolean}
                onChange={() => toggle(key, label)}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: C.green, cursor: "pointer" }}
            />
            <span style={{ fontFamily: font, fontSize: 15, color: C.ink, lineHeight: 1.35 }}>
                <strong style={{ fontWeight: 800 }}>{label}</strong>
                <br />
                <span style={{ opacity: 0.8, fontSize: 13 }}>{hint}</span>
            </span>
        </label>
    )

    return (
        <div data-cb-dial="true" style={anchor}>
            <link href="https://fonts.googleapis.com/css2?family=Passion+One&family=Bricolage+Grotesque:wght@500;700;800&display=swap" rel="stylesheet" />

            {/* Live region for announcements */}
            <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {announce}
            </div>

            {/* Panel */}
            <AnimatePresence>
                {(open || isCanvas) && (
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-label="Accessibility and craziness settings"
                        tabIndex={-1}
                        initial={prefs.mode === "calm" ? { opacity: 0 } : { opacity: 0, y: inline ? -12 : 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: inline ? -8 : 8 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        style={{
                            position: "absolute",
                            ...panelPos,
                            width: "min(340px, calc(100vw - 40px))",
                            background: C.cream,
                            border: `3px solid ${C.ink}`,
                            borderRadius: 20,
                            padding: 20,
                            boxShadow: "0 16px 48px rgba(28,43,28,0.35)",
                        } as any}
                    >
                        <h2 style={{ fontFamily: display, fontSize: 28, color: C.green, margin: "0 0 2px", textTransform: "uppercase", lineHeight: 1 }}>
                            How crazy should this website be?
                        </h2>
                        <p style={{ fontFamily: font, fontSize: 13, color: C.ink, opacity: 0.8, margin: "4px 0 14px" }}>
                            Your call. We save it for next time.
                        </p>

                        {/* Mode buttons (toggle group) */}
                        <div role="group" aria-label="Website energy level" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                            {(Object.keys(MODE_COPY) as Mode[]).map((m) => {
                                const on = prefs.mode === m
                                const accent = modeAccent[m]
                                return (
                                    <button
                                        key={m}
                                        aria-pressed={on}
                                        onClick={() => setMode(m)}
                                        style={{
                                            fontFamily: font,
                                            textAlign: "left",
                                            border: `2px solid ${on ? accent : "rgba(28,43,28,0.35)"}`,
                                            background: on ? C.white : "transparent",
                                            borderRadius: 12,
                                            padding: "10px 14px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <span style={{ fontWeight: 800, fontSize: 16, color: on ? accent : C.ink }}>{MODE_COPY[m].label}</span>
                                        <br />
                                        <span style={{ fontSize: 13, color: C.ink, opacity: 0.8 }}>{MODE_COPY[m].blurb}</span>
                                    </button>
                                )
                            })}
                        </div>

                        <div style={{ height: 2, background: "rgba(28,43,28,0.12)", margin: "4px 0 8px" }} />

                        {checkboxRow("bigText", "Bigger everything", "Bumps the whole site up 15%.")}
                        {checkboxRow("underlineLinks", "Underline links", "Links stop hiding.")}
                        {checkboxRow("strongFocus", "Bold focus outlines", "Keyboard users see exactly where they are.")}

                        <button
                            onClick={() => {
                                setOpen(false)
                                triggerRef.current?.focus()
                            }}
                            style={{
                                fontFamily: font,
                                fontWeight: 800,
                                fontSize: 15,
                                width: "100%",
                                marginTop: 12,
                                background: C.green,
                                color: C.white,
                                border: "none",
                                borderRadius: 999,
                                padding: "12px 20px",
                                cursor: "pointer",
                            }}
                        >
                            Looks good
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trigger */}
            <motion.button
                ref={triggerRef}
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label="Accessibility and craziness settings"
                whileHover={prefs.mode === "calm" ? undefined : { scale: 1.08, rotate: -6 }}
                whileTap={prefs.mode === "calm" ? undefined : { scale: 0.92 }}
                style={{
                    width: triggerSize,
                    height: triggerSize,
                    borderRadius: "50%",
                    border: `${inline ? 2.5 : 3}px solid ${C.ink}`,
                    background: triggerBg,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: inline ? "0 2px 8px rgba(28,43,28,0.18)" : "0 6px 20px rgba(28,43,28,0.3)",
                }}
            >
                {/* Dial glyph */}
                <svg width={glyphSize} height={glyphSize} viewBox="0 0 28 28" fill="none" aria-hidden="true">
                    <circle cx="14" cy="14" r="10" stroke={glyphColor} strokeWidth="3" />
                    <motion.line
                        x1="14"
                        y1="14"
                        x2="14"
                        y2="6"
                        stroke={glyphColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        animate={{ rotate: prefs.mode === "calm" ? -60 : prefs.mode === "classic" ? 0 : 60 }}
                        style={{ originX: "14px", originY: "14px" } as any}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    />
                </svg>
            </motion.button>
        </div>
    )
}

addPropertyControls(CrazyDial, {
    placement: {
        type: ControlType.Enum,
        title: "Placement",
        options: ["floating", "inline"],
        optionTitles: ["Floating corner", "Inline (navbar)"],
        defaultValue: "floating",
    },
    corner: {
        type: ControlType.Enum,
        title: "Align",
        options: ["bottom-left", "bottom-right"],
        optionTitles: ["Left", "Right"],
        defaultValue: "bottom-left",
    },
})

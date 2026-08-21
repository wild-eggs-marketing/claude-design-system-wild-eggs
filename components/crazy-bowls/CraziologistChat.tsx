import { useState, useRef, useEffect, useCallback } from "react"
// @ts-ignore — react-dom exists at runtime in Framer; type declarations are not bundled
import { createPortal } from "react-dom"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// ---------- Brand tokens ----------
const C = {
    cream: "rgb(255, 242, 230)",
    ink: "rgb(28, 43, 28)",
    green: "rgb(18, 58, 20)",
    lime: "rgb(163, 191, 30)",
    apricot: "rgb(242, 119, 78)",
    teal: "rgb(13, 79, 79)",
    dragonfruit: "rgb(218, 45, 101)",
    white: "rgb(255, 255, 255)",
}
const FONT = "'Bricolage Grotesque', sans-serif"
const DISPLAY = "'Passion One', sans-serif"

// Quiz archetypes (synced with QuizYourCrazy.tsx, localStorage key qcr_last)
const ARCHETYPES: Record<string, string> = {
    "high-protein-bowl": "The Gains Goblin",
    "buffalo-bowl": "The Heat Seeker",
    "thai-bowl": "The Peanut Prophet",
    "jerk-bowl": "The Island Optimist",
    "fajita-bowl": "The Fiesta Instigator",
    "mediterranean-bowl": "The Main Character",
    "pesto-bowl": "The Pesto Romantic",
    "power-bowl": "The Overachiever",
    "poke-bowl": "The Raw Talent",
    "teriyaki-bowl": "The Zen Machine",
    "caesar-bowl": "The Sensible Legend",
    "bbq-bowl": "The Backyard Boss",
    "stir-fry-bowl": "The Steady Hand",
    "lettuce-wraps": "The Featherweight Champ",
}

/* ============================================================================
   LIMITED-TIME PROMO LAYER — "CHIP YEAH" catering offer
   ----------------------------------------------------------------------------
   Fires for anyone who (a) arrives from the email campaign or (b) is on
   /catering, while an offer phase is live. Everything self-expires: once the
   last phase's endsISO passes, the widget silently reverts to normal behavior
   with zero code changes.

   PHASES exist because the offer threshold steps down mid-run. The component
   picks whichever phase contains "now" (America/Chicago) at page load, so the
   $150 -> $100 switch happens by itself at midnight. No republish required at
   the moment it flips.

   To extend or end the offer: edit the last phase's `endsISO`, nothing else.
   To run a DIFFERENT promo later: replace the PHASES array. The rest of the
   component needs no edits.
   ========================================================================== */
type PromoPhase = {
    id: string
    startsISO: string
    endsISO: string
    campaign: string
    path: string
    code: string
    ribbon: string
    teaser: string
    opener: string
    chip: { label: string; q: string }
    answer: string
}

/* Offer questions are answered from the copy above, never by the model.
   Two reasons, both load-bearing:
   1. VERIFIED 2026-08-18 against the live Worker: it is grounding-hardened and
      has no record of this promo, so it refuses ("I can't confirm that"), calls
      escalate, and points the guest at contact-us. Worse than saying nothing.
      Re-test after any Worker deploy that teaches it the offer.
   2. Offer terms are legal copy. They must not be improvised, ever.
   Everything that is NOT an offer question still goes to the Worker as normal. */
const OFFER_RX =
    /\b(chip ?yeah|chip platter|free (chips?|platter|food)|(any|some)thing free|promo(tion)?s?|coupon|discount|specials|freebies?|(the|this|that|any|your|a) deal|deals|(the|any|your|current) offers?|catering (deal|offer|promo|special))\b/i
// "what's the code?" counts. "zip code" does not — the bot asks for those.
const BARE_CODE_RX = /\bcode\b/i
const ZIP_CODE_RX = /\b(zip|postal|area)\s*code\b/i

// Deliberately wide. The two failure modes are lopsided: a false positive gives
// someone the offer terms plus an invitation to talk headcounts, which is fine;
// a false negative sends an offer question to a Worker that has no record of the
// promo, so it denies the offer exists and escalates to a human. Favor catching.
// NUTRITION_RX is the one hard veto — allergen, macro and ingredient questions
// must always reach the Worker, which has the real data and the disclaimer.
// (NUTRITION_RX is declared further down; this only reads it at call time.)
function asksAboutOffer(text: string): boolean {
    if (NUTRITION_RX.test(text)) return false
    if (OFFER_RX.test(text)) return true
    return BARE_CODE_RX.test(text) && !ZIP_CODE_RX.test(text)
}

const PROMO_PHASES: PromoPhase[] = [
    {
        // Phase 1 — original send. $150 threshold, ends Tue 8/18 at midnight CT.
        id: "chip-yeah-catering-150",
        startsISO: "2026-08-11T00:00:00-05:00",
        endsISO: "2026-08-18T23:59:59-05:00",
        campaign: "catering-chip-platter-aug",
        path: "/catering",
        code: "CHIPYEAH",
        ribbon: "Free chip platter on $150+ catering",
        teaser: "Free chip platter on $150+ catering. Ask me.",
        opener:
            "Feeding a crowd? Good timing. Cater $150 or more and a large chip platter is on us. Code CHIPYEAH at online checkout, through tonight. Ask me about platters, headcounts, or what survives a 30-minute car ride.",
        chip: {
            label: "Tell me about the chip deal",
            q: "Tell me about the free chip platter offer for catering.",
        },
        answer:
            "Chip yeah. Cater $150 or more (pre-tax) and a large chip platter comes along free. " +
            "Enter code **CHIPYEAH** at online checkout, through tonight. One per order, and it " +
            "doesn't stack with other offers.\n\n" +
            "Order here: [crazybowlsandwraps.com/catering](https://www.crazybowlsandwraps.com/catering?utm_source=site&utm_medium=chat_promo&utm_campaign=catering-chip-platter-aug&utm_content=offer-answer)\n\n" +
            "Want help sizing it? Tell me your headcount and I'll do the math.",
    },
    {
        // Phase 2 — threshold drops to $100, starts Wed 8/19.
        // End date confirmed by Elle 2026-08-21: runs through Mon 8/31.
        // The r2 catering email (send Mon 8/24) states the same date. If the
        // offer moves, change it HERE and in that email or they contradict.
        id: "chip-yeah-catering-100",
        startsISO: "2026-08-19T00:00:00-05:00",
        endsISO: "2026-08-31T23:59:59-05:00",
        campaign: "catering-chip-platter-aug",
        path: "/catering",
        code: "CHIPYEAH",
        ribbon: "Free chip platter on $100+ catering",
        teaser: "Free chip platter on $100+ catering. Ask me.",
        opener:
            "Feeding a crowd? Good timing. Cater $100 or more and a large chip platter is on us. Code CHIPYEAH at online checkout. Ask me about platters, headcounts, or what survives a 30-minute car ride.",
        chip: {
            label: "Tell me about the chip deal",
            q: "Tell me about the free chip platter offer for catering.",
        },
        answer:
            "Chip yeah. Cater $100 or more (pre-tax) and a large chip platter comes along free. " +
            "Enter code **CHIPYEAH** at online checkout. One per order, and it doesn't stack " +
            "with other offers.\n\n" +
            "Order here: [crazybowlsandwraps.com/catering](https://www.crazybowlsandwraps.com/catering?utm_source=site&utm_medium=chat_promo&utm_campaign=catering-chip-platter-aug&utm_content=offer-answer)\n\n" +
            "Want help sizing it? Tell me your headcount and I'll do the math.",
    },
]

// The phase whose window contains right now, or null when nothing is running.
function activePhase(): PromoPhase | null {
    try {
        const now = Date.now()
        for (const p of PROMO_PHASES) {
            if (
                now >= new Date(p.startsISO).getTime() &&
                now <= new Date(p.endsISO).getTime()
            )
                return p
        }
    } catch {
        /* bad date string — fail closed, show no offer */
    }
    return null
}

// Copy source for the UI. Falls back to the last phase purely so the JSX has
// strings to reference; nothing renders unless promoLive() is also true.
const PROMO: PromoPhase =
    activePhase() || PROMO_PHASES[PROMO_PHASES.length - 1]

// A phase is live AND this visitor is in scope (catering page or campaign click)
function promoLive(): boolean {
    try {
        if (typeof window === "undefined") return false
        const phase = activePhase()
        if (!phase) return false
        const path = window.location.pathname.toLowerCase()
        const qs = window.location.search || ""
        return (
            path.indexOf(phase.path) !== -1 ||
            qs.indexOf("utm_campaign=" + phase.campaign) !== -1
        )
    } catch {
        return false
    }
}

// First chip routes to the quiz; the rest are questions
const QUICK_CHIPS: { label: string; q?: string; href?: string }[] = [
    { label: "Find my bowlmate", href: "/quiz-your-crazy" },
    { label: "Is my store open right now?", q: "Is my store open right now?" },
    { label: "How do I order?", q: "How do I order?" },
    { label: "What should I get?", q: "What should I get?" },
]

// Real progress lines, driven by which tool the worker is actually using
const STATUS_LINES: Record<string, string> = {
    searchMenu: "Flipping through the menu...",
    getItem: "Pulling that item's file...",
    excludeAllergens: "Cross-checking allergen panels...",
    macroMath: "Doing carrot math...",
    nearestOpenStore: "Checking who's open...",
    orderLink: "Grabbing your link...",
    escalate: "Looping in a human...",
    rewrite: "My inner editor rejected that draft. Rewriting...",
}
const IDLE_LINES = [
    "Consulting the database...",
    "Interrogating the beans...",
    "Reading the fine print so you don't have to...",
]

const AI_NOTE =
    "The Craziologist is a very smart carrot, but still an AI. It can make mistakes. For allergies, always confirm with our team in-store."
const NUTRITION_DISCLAIMER =
    "Please note that these nutrition values are estimated based on our standard serving portions. As food servings may have a slight variance each time you visit, please expect these values to be within 10% +/- of your actual meal. If you have any questions about our nutrition calculator, please contact Nutritionix. For allergies, always confirm with our team in-store."
const NUTRITION_RX =
    /\b(calor|protein|carb|fat\b|macro|nutrition|allerg|gluten|vegan|vegetarian|dairy|nut|soy|wheat|sesame|shellfish|ingredient)/i

// Page-aware openers, keyed by pathname prefix (first match wins)
const PAGE_OPENERS: [string, string][] = [
    [
        "/menu",
        "You're staring at a whole lot of menu. I know every item personally. Tell me a craving or a macro and I'll narrow it down.",
    ],
    [
        "/locations",
        "Looking for us? Give me a zip code and I'll tell you the nearest store and whether it's open right now.",
    ],
    [
        "/catering",
        "Feeding a crowd? Smart. Ask me about platters, headcounts, or what survives a 30-minute car ride best.",
    ],
    [
        "/loyalty",
        "Crazy Points question? I can explain how the free food math works. Spoiler: it works in your favor.",
    ],
    [
        "/quiz-your-crazy",
        "Take the quiz first, then come back and I'll have opinions about your result. I always do.",
    ],
]

type Msg = { role: "user" | "assistant"; content: string }

// Session persistence: conversation survives page navigation within a visit
function loadState(): any {
    try {
        if (typeof window === "undefined") return null
        return JSON.parse(window.sessionStorage.getItem("czg_state") || "null")
    } catch {
        return null
    }
}

// GA4 / dataLayer instrumentation (no-op when analytics absent)
function track(event: string, params: Record<string, any> = {}) {
    try {
        const w = window as any
        if (typeof w.gtag === "function") w.gtag("event", event, params)
        if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event, ...params })
    } catch {
        /* noop */
    }
}

// Display label for a bare URL: strip protocol, query (utm etc.), and trailing slash
function cleanLabel(url: string): string {
    try {
        const u = new URL(url)
        const path = u.pathname.replace(/\/$/, "")
        const label =
            u.host.replace(/^www\./, "") +
            (path.length > 1 && path.length <= 24 ? path : "")
        return label.length > 42 ? label.slice(0, 40) + "…" : label
    } catch {
        return url.split("?")[0]
    }
}

// Time-aware greeting flavor
function timeFlavor(): string {
    const h = new Date().getHours()
    if (h < 10)
        return "Breakfast hours. The eggs are fresh-cracked and so am I."
    if (h >= 21 || h < 5)
        return "Kitchens are asleep till tomorrow. Planning ahead? Respect."
    if (h >= 11 && h < 14)
        return "Peak lunch. The line moves faster when you know your order."
    return ""
}

// Living vector carrot: blinks when idle, mouth opens while thinking, grins when happy
function CarrotMark({
    size = 34,
    mood = "idle",
}: {
    size?: number
    mood?: "idle" | "busy" | "happy"
}) {
    const mouth =
        mood === "busy" ? (
            <ellipse cx="30" cy="29" rx="2.6" ry="3.4" fill={C.ink} />
        ) : mood === "happy" ? (
            <path
                d="M25 28 Q30 34 35 26"
                stroke={C.ink}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
        ) : (
            <path
                d="M27 29 Q30 31 33 27"
                stroke={C.ink}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
            />
        )
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            aria-hidden="true"
            style={{ overflow: "visible" }}
        >
            <path
                d="M30 14 L14 40 Q12 44 16 42 L38 24 Q40 22 36 20 Z"
                fill={C.apricot}
            />
            <path
                d="M32 12 Q34 4 40 4 Q36 10 38 12 Q44 8 46 12 Q40 14 38 16 Q42 20 40 24 Q36 18 34 16 Z"
                fill={C.lime}
            />
            <g
                style={{
                    animation:
                        mood === "idle"
                            ? "czg-blink 4.4s ease-in-out infinite"
                            : "none",
                    transformOrigin: "29px 22px",
                }}
            >
                <circle cx="27" cy="24" r="1.8" fill={C.ink} />
                <circle cx="32" cy="20" r="1.8" fill={C.ink} />
            </g>
            {mouth}
            <style>{`@keyframes czg-blink { 0%, 92%, 100% { transform: scaleY(1) } 95% { transform: scaleY(0.1) } }`}</style>
        </svg>
    )
}

// Small vector thumb for feedback (brand rule: no emoji)
function Thumb({ down = false }: { down?: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{
                transform: down ? "rotate(180deg)" : "none",
                display: "block",
            }}
        >
            <path
                d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm2 9V10.6L12.3 4a1.8 1.8 0 0 1 2.6 1.6l-.6 3.9h4.4a2 2 0 0 1 2 2.4l-1.2 6.4a2 2 0 0 1-2 1.7H9z"
                fill="currentColor"
            />
        </svg>
    )
}

/**
 * THE CRAZIOLOGIST — chat widget wired to the certified chat Worker.
 * Includes a self-expiring promo layer (see PROMO_PHASES above).
 *
 * @framerIntrinsicWidth 380
 * @framerIntrinsicHeight 560
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function CraziologistChat(props: any) {
    const {
        endpoint = "https://craziologist-chat.elle-f37.workers.dev/chat",
        avatar = "",
        startOpen = false,
        accent = C.lime,
        offsetX = 20,
        offsetY = 20,
        appearDelay = 10,
        promoEnabled = true,
        promoTeaserDelay = 3.5,
    } = props
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const savedRef = useRef<any>(undefined)
    if (savedRef.current === undefined)
        savedRef.current = isCanvas ? null : loadState()
    const saved = savedRef.current

    // Promo scope resolved once per mount (same lazy-ref pattern as saved state)
    const promoRef = useRef<boolean | undefined>(undefined)
    if (promoRef.current === undefined)
        promoRef.current = isCanvas ? false : promoEnabled && promoLive()
    const promoOn = promoRef.current

    // Singleton: if the widget is placed more than once on a page (footer + direct), only one mounts
    const [primary, setPrimary] = useState(isCanvas)
    const [visible, setVisible] = useState(isCanvas || !!saved)
    const [open, setOpen] = useState(startOpen || isCanvas || !!saved?.open)
    const [msgs, setMsgs] = useState<Msg[]>(saved?.msgs || [])
    const [input, setInput] = useState("")
    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState<string | null>(null)
    const [idleLine, setIdleLine] = useState(0)
    const [nutritionSeen, setNutritionSeen] = useState(!!saved?.nutritionSeen)
    const [confetti, setConfetti] = useState(false)
    const [stamp, setStamp] = useState(false)
    const [reduceMotion, setReduceMotion] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [teaser, setTeaser] = useState(false)
    const [votes, setVotes] = useState<Record<number, string>>({})
    const confettiUsed = useRef(!!saved?.confetti)
    const logRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const typewriterRef = useRef<any>(null)

    const mood: "idle" | "busy" | "happy" = busy
        ? "busy"
        : stamp || confetti
          ? "happy"
          : "idle"

    useEffect(() => {
        if (isCanvas || typeof window === "undefined") return
        const w = window as any
        if (w.__czg_mounted) return
        w.__czg_mounted = true
        setPrimary(true)
        return () => {
            w.__czg_mounted = false
        }
    }, [isCanvas])

    // Deep link: ?chat=open or #chat opens the widget immediately (emails, QR codes, social bios)
    useEffect(() => {
        if (isCanvas || typeof window === "undefined") return
        if (
            /[?&]chat=open\b/.test(window.location.search) ||
            window.location.hash === "#chat"
        ) {
            setVisible(true)
            setOpen(true)
            track("czg_deeplink_open")
        }
    }, [isCanvas])

    // Promo visitors see the launcher sooner — the offer is the reason they're here
    useEffect(() => {
        if (isCanvas || visible) return
        const delaySec = promoOn
            ? Math.min(appearDelay, 3)
            : Math.max(0, appearDelay)
        const t = setTimeout(() => setVisible(true), delaySec * 1000)
        return () => clearTimeout(t)
    }, [isCanvas, appearDelay, visible, promoOn])

    // Teaser bubble above the launcher. During the promo it carries the offer,
    // fires sooner, and uses its own session key so it still shows to someone
    // who already saw the generic teaser earlier in the visit.
    useEffect(() => {
        if (isCanvas || !visible || open || typeof window === "undefined")
            return
        const key = promoOn ? "czg_teased_" + PROMO.id : "czg_teased"
        try {
            if (window.sessionStorage.getItem(key)) return
            if (!promoOn && (saved?.msgs?.length || 0) > 1) return
        } catch {
            return
        }
        const wait = promoOn ? Math.max(0, promoTeaserDelay) * 1000 : 6000
        const t = setTimeout(() => {
            setTeaser(true)
            track(promoOn ? "czg_promo_teaser_shown" : "czg_teaser_shown", {
                promo: promoOn ? PROMO.id : undefined,
            })
            try {
                window.sessionStorage.setItem(key, "1")
            } catch {
                /* noop */
            }
        }, wait)
        return () => clearTimeout(t)
    }, [isCanvas, visible, open, promoOn, promoTeaserDelay])

    // Persist conversation + state across page navigation (session-scoped)
    useEffect(() => {
        if (isCanvas || !primary || typeof window === "undefined") return
        try {
            window.sessionStorage.setItem(
                "czg_state",
                JSON.stringify({
                    msgs: msgs.slice(-30),
                    open,
                    nutritionSeen,
                    confetti: confettiUsed.current,
                })
            )
        } catch {
            /* storage full or blocked */
        }
    }, [msgs, open, nutritionSeen, isCanvas, primary])

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduceMotion(mq.matches)
        const fn = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
        mq.addEventListener("change", fn)
        const mob = window.matchMedia("(max-width: 640px)")
        setIsMobile(mob.matches)
        const fm = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mob.addEventListener("change", fm)
        return () => {
            mq.removeEventListener("change", fn)
            mob.removeEventListener("change", fm)
        }
    }, [])

    // Esc closes; click outside the panel closes
    useEffect(() => {
        if (isCanvas || !open || typeof document === "undefined") return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        const onDown = (e: MouseEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node)
            )
                setOpen(false)
        }
        document.addEventListener("keydown", onKey)
        document.addEventListener("mousedown", onDown)
        return () => {
            document.removeEventListener("keydown", onKey)
            document.removeEventListener("mousedown", onDown)
        }
    }, [isCanvas, open])

    // Quiz-first greeting + archetype handshake + page-aware opener + time flavor.
    // While the promo is live and in scope, the offer leads — it is why they came.
    useEffect(() => {
        if (msgs.length) return
        const flavor = timeFlavor()
        let greeting =
            "Hey. Resident carrot, dangerously well-informed. First time here? Take the Crazy Quiz and find your bowlmate, the bowl you were meant to meet. Or just ask me anything: hours, ordering, what to get."
        try {
            const path =
                typeof window !== "undefined" ? window.location.pathname : ""
            const pageLine = PAGE_OPENERS.find(([p]) => path.startsWith(p))?.[1]
            if (pageLine) greeting = pageLine
            const slug =
                typeof window !== "undefined"
                    ? window.localStorage.getItem("qcr_last")
                    : null
            const arch = slug ? ARCHETYPES[slug] : null
            if (arch)
                greeting =
                    `${arch}. Welcome back, your bowlmate misses you. ` +
                    (pageLine || "Hours, ordering, or a new obsession? Hit me.")
            if (promoOn) {
                greeting = arch
                    ? `${arch}, feeding the whole crew this time? ` + PROMO.opener
                    : PROMO.opener
            }
        } catch {
            /* private browsing */
        }
        setMsgs([
            {
                role: "assistant",
                content: flavor && !promoOn ? flavor + "\n\n" + greeting : greeting,
            },
        ])
    }, [msgs.length, promoOn])

    useEffect(() => {
        logRef.current?.scrollTo({
            top: logRef.current.scrollHeight,
            behavior: reduceMotion ? "auto" : "smooth",
        })
    }, [msgs, busy, status, reduceMotion])

    useEffect(() => {
        if (!busy || status) return
        const t = setInterval(
            () => setIdleLine((n) => (n + 1) % IDLE_LINES.length),
            2400
        )
        return () => clearInterval(t)
    }, [busy, status])

    useEffect(() => () => clearInterval(typewriterRef.current), [])

    const resetChat = useCallback(() => {
        clearInterval(typewriterRef.current)
        setMsgs([])
        setVotes({})
        setNutritionSeen(false)
        setBusy(false)
        setStatus(null)
        try {
            window.sessionStorage.removeItem("czg_state")
        } catch {
            /* noop */
        }
        track("czg_reset")
    }, [])

    const pushReply = useCallback(
        (text: string) => {
            if (NUTRITION_RX.test(text)) setNutritionSeen(true)
            if (reduceMotion || text.length < 40) {
                setMsgs((m) => [...m, { role: "assistant", content: text }])
                return
            }
            setMsgs((m) => [...m, { role: "assistant", content: "" }])
            let i = 0
            clearInterval(typewriterRef.current)
            typewriterRef.current = setInterval(() => {
                i = Math.min(text.length, i + 4)
                const slice = text.slice(0, i)
                setMsgs((m) => {
                    const copy = [...m]
                    copy[copy.length - 1] = {
                        role: "assistant",
                        content: slice,
                    }
                    return copy
                })
                if (i >= text.length) clearInterval(typewriterRef.current)
            }, 16)
        },
        [reduceMotion]
    )

    const send = useCallback(
        async (forced?: string) => {
            const text = (forced ?? input).trim()
            if (!text || busy || isCanvas) return
            setInput("")
            if (NUTRITION_RX.test(text)) setNutritionSeen(true)
            if (
                /\bcrazy\b/i.test(text) &&
                !confettiUsed.current &&
                !reduceMotion
            ) {
                confettiUsed.current = true
                setConfetti(true)
                track("czg_confetti")
                setTimeout(() => setConfetti(false), 1600)
            }
            const next: Msg[] = [...msgs, { role: "user", content: text }]
            setMsgs(next)
            // Offline: fail fast with a useful answer instead of a hanging spinner
            if (
                typeof navigator !== "undefined" &&
                navigator.onLine === false
            ) {
                setMsgs((m) => [
                    ...m,
                    {
                        role: "assistant",
                        content:
                            "Your connection dropped, not my brain. Reconnect and ask again, or order directly at crazybowlsandwraps.com.",
                    },
                ])
                track("czg_offline")
                return
            }
            setBusy(true)
            setStatus(null)
            track("czg_send", {
                chars: text.length,
                promo: promoOn ? PROMO.id : undefined,
            })
            const started = Date.now()
            const finish = (reply: string, escalated?: boolean) => {
                track("czg_reply", {
                    latency_ms: Date.now() - started,
                    escalated: !!escalated,
                })
                pushReply(reply)
                setBusy(false)
                setStatus(null)
                inputRef.current?.focus()
            }
            // Offer questions never reach the model (see OFFER_RX above). Exact
            // terms, no escalation, no round trip. A short beat first so the
            // answer lands like a reply and not a vending machine.
            if (promoOn && asksAboutOffer(text)) {
                track("czg_promo_answered", { promo: PROMO.id })
                setStatus("Reading the fine print so you don't have to...")
                setTimeout(() => finish(PROMO.answer), 420)
                return
            }
            // Everything else goes to the Worker untouched. `promo` rides along
            // so the Worker can pick it up once it knows about the offer.
            const payload = {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    messages: next.slice(-16),
                    promo: promoOn ? PROMO.id : undefined,
                }),
            }
            try {
                const r = await fetch(
                    endpoint.replace(/\/chat$/, "/chat-stream"),
                    payload as any
                )
                if (!r.ok || !r.body) throw new Error("stream unavailable")
                const reader = r.body.getReader()
                const dec = new TextDecoder()
                let buf = ""
                let done = false
                while (!done) {
                    const { value, done: rd } = await reader.read()
                    if (rd) break
                    buf += dec.decode(value, { stream: true })
                    const lines = buf.split("\n\n")
                    buf = lines.pop() || ""
                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue
                        try {
                            const ev = JSON.parse(line.slice(6))
                            if (ev.type === "status")
                                setStatus(STATUS_LINES[ev.tool] || null)
                            if (ev.type === "reply") {
                                finish(ev.reply, ev.escalated)
                                done = true
                            }
                        } catch {
                            /* partial frame */
                        }
                    }
                }
                if (!done) throw new Error("stream ended without reply")
            } catch {
                try {
                    const r2 = await fetch(endpoint, payload as any)
                    const data = await r2.json()
                    finish(
                        data.reply ||
                            "The carrot is briefly offline. Try again in a moment.",
                        data.escalated
                    )
                } catch {
                    finish(
                        "The carrot is briefly offline. Try again in a moment, or order directly at crazybowlsandwraps.com."
                    )
                }
            }
        },
        [input, busy, msgs, endpoint, isCanvas, pushReply, promoOn]
    )

    const celebrate = useCallback(() => {
        if (reduceMotion) return
        setStamp(true)
        setTimeout(() => setStamp(false), 1400)
    }, [reduceMotion])

    const vote = useCallback((i: number, v: "up" | "down") => {
        setVotes((prev) => (prev[i] ? prev : { ...prev, [i]: v }))
        track("czg_feedback", { vote: v, message_index: i })
    }, [])

    // Open the panel from the promo teaser and ask the offer question for them
    const openFromPromo = useCallback(() => {
        setTeaser(false)
        setOpen(true)
        track("czg_promo_teaser_click", { promo: PROMO.id })
        setTimeout(() => send(PROMO.chip.q), 260)
    }, [send])

    // Render bot text: clickable tracked links (clean labels, UTMs stay in href) + **bold**
    const renderText = (t: string) => {
        const parts = t.split(
            /(\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/\S+|\*\*[^*]+\*\*)/g
        )
        const link = (href: string, label: string, i: number) => (
            <a
                key={i}
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                    const isOrder = /order/i.test(href)
                    track(isOrder ? "czg_order_click" : "czg_link_click", {
                        url: href,
                        promo: promoOn ? PROMO.id : undefined,
                    })
                    if (isOrder) celebrate()
                }}
                style={{
                    color: C.teal,
                    fontWeight: 700,
                    wordBreak: "break-word",
                }}
            >
                {label}
            </a>
        )
        return parts.map((p, i) => {
            const md = p.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
            if (md) return link(md[2], md[1], i)
            if (/^https?:\/\//.test(p)) {
                const trail = p.match(/[).,!?]+$/)?.[0] || ""
                const url = trail ? p.slice(0, -trail.length) : p
                return (
                    <span key={i}>
                        {link(url, cleanLabel(url), i)}
                        {trail}
                    </span>
                )
            }
            const bold = p.match(/^\*\*([^*]+)\*\*$/)
            if (bold) return <strong key={i}>{bold[1]}</strong>
            return <span key={i}>{p}</span>
        })
    }

    const Avatar = ({ size = 34 }: { size?: number }) =>
        avatar ? (
            <img
                src={avatar}
                alt=""
                width={size}
                height={size}
                style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    background: C.cream,
                }}
            />
        ) : (
            <CarrotMark size={size} mood={reduceMotion ? "idle" : mood} />
        )

    const showChips = msgs.length === 1 && !busy
    const chips = promoOn ? [PROMO.chip as any].concat(QUICK_CHIPS) : QUICK_CHIPS
    const confettiDots = [
        C.lime,
        C.apricot,
        C.teal,
        C.lime,
        C.apricot,
        C.lime,
        C.teal,
        C.apricot,
        C.lime,
        C.apricot,
        C.teal,
        C.lime,
        C.apricot,
        C.lime,
    ]
    const mobileSheet = isMobile && open && !isCanvas

    const widget = (
        <div
            style={
                isCanvas
                    ? {
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          fontFamily: FONT,
                      }
                    : {
                          position: "fixed",
                          right: mobileSheet ? 0 : offsetX,
                          bottom: mobileSheet ? 0 : offsetY,
                          left: mobileSheet ? 0 : "auto",
                          zIndex: 2147483000,
                          fontFamily: FONT,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          opacity: visible ? 1 : 0,
                          transform: visible
                              ? "translateY(0) scale(1)"
                              : "translateY(16px) scale(0.9)",
                          transition: reduceMotion
                              ? "opacity 0.2s"
                              : "opacity 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s cubic-bezier(0.16,1,0.3,1)",
                          pointerEvents: visible ? "auto" : "none",
                      }
            }
        >
            {/* Teaser bubble — promo copy while the offer is live, otherwise the standard nudge */}
            {!open && teaser && !isCanvas && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                        maxWidth: 268,
                        background: C.white,
                        border: `2px solid ${C.ink}`,
                        borderRadius: 14,
                        padding: "10px 12px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: C.ink,
                        boxShadow: `3px 3px 0 ${promoOn ? C.dragonfruit : C.apricot}`,
                    }}
                >
                    {promoOn ? (
                        <button
                            onClick={openFromPromo}
                            style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                margin: 0,
                                textAlign: "left",
                                font: "inherit",
                                color: C.ink,
                                cursor: "pointer",
                            }}
                        >
                            <span
                                style={{
                                    display: "block",
                                    fontFamily: DISPLAY,
                                    fontSize: 20,
                                    lineHeight: 1,
                                    color: C.dragonfruit,
                                    letterSpacing: "0.02em",
                                }}
                            >
                                CHIP YEAH.
                            </span>
                            <span style={{ display: "block", marginTop: 3 }}>
                                {PROMO.teaser}
                            </span>
                        </button>
                    ) : (
                        <span>
                            Lost in the menu? I know every item personally.
                        </span>
                    )}
                    <button
                        onClick={() => {
                            setTeaser(false)
                            if (promoOn)
                                track("czg_promo_teaser_dismiss", {
                                    promo: PROMO.id,
                                })
                        }}
                        aria-label="Dismiss"
                        style={{
                            background: "transparent",
                            border: "none",
                            color: C.ink,
                            fontSize: 18,
                            cursor: "pointer",
                            lineHeight: 1,
                            padding: 2,
                            flexShrink: 0,
                            alignSelf: "flex-start",
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Launcher */}
            {!open && (
                <button
                    onClick={() => {
                        setOpen(true)
                        setTeaser(false)
                        track("czg_open", {
                            promo: promoOn ? PROMO.id : undefined,
                        })
                    }}
                    aria-label="Chat with the Craziologist"
                    onMouseEnter={(e) => {
                        if (!reduceMotion)
                            e.currentTarget.style.transform =
                                "rotate(-2deg) scale(1.04)"
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform =
                            "rotate(0deg) scale(1)"
                    }}
                    style={{
                        ...(isCanvas
                            ? { position: "absolute", right: 0, bottom: 0 }
                            : {}),
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: C.white,
                        color: C.ink,
                        border: `3px solid ${C.ink}`,
                        borderRadius: 999,
                        padding: "8px 20px 8px 8px",
                        fontFamily: DISPLAY,
                        fontSize: 20,
                        letterSpacing: "0.02em",
                        cursor: "pointer",
                        boxShadow: `4px 4px 0 ${promoOn ? C.dragonfruit : C.lime}`,
                        transition: reduceMotion
                            ? "none"
                            : "transform 0.15s ease-out",
                    }}
                >
                    <span
                        style={{
                            background: C.cream,
                            border: `2px solid ${C.ink}`,
                            borderRadius: "50%",
                            width: 44,
                            height: 44,
                            display: "grid",
                            placeItems: "center",
                        }}
                    >
                        <Avatar size={32} />
                    </span>
                    ASK THE CRAZIOLOGIST
                </button>
            )}

            {/* Panel */}
            {open && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label="Craziologist chat"
                    style={{
                        ...(isCanvas
                            ? {
                                  position: "absolute",
                                  right: 0,
                                  bottom: 0,
                                  width: "min(380px, 100%)",
                                  height: "min(560px, 100%)",
                                  borderRadius: 22,
                              }
                            : mobileSheet
                              ? {
                                    width: "100vw",
                                    height: "min(85dvh, 700px)",
                                    borderRadius: "22px 22px 0 0",
                                    borderBottom: "none",
                                }
                              : {
                                    width: "min(400px, calc(100vw - 32px))",
                                    height: "min(600px, calc(100dvh - 90px))",
                                    borderRadius: 22,
                                }),
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        background: C.white,
                        overflow: "hidden",
                        border: `3px solid ${C.ink}`,
                        boxShadow: mobileSheet ? "none" : `6px 6px 0 ${C.lime}`,
                    }}
                >
                    {/* WOW overlays */}
                    {confetti && (
                        <div
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                zIndex: 5,
                                overflow: "hidden",
                            }}
                        >
                            {confettiDots.map((col, i) => (
                                <span
                                    key={i}
                                    style={{
                                        position: "absolute",
                                        top: -12,
                                        left: `${(i * 7 + 4) % 96}%`,
                                        width: 9,
                                        height: 9,
                                        borderRadius: i % 3 === 0 ? "50%" : 2,
                                        background: col,
                                        animation: `czg-fall 1.5s ease-in ${i * 0.05}s forwards`,
                                    }}
                                />
                            ))}
                            <style>{`@keyframes czg-fall { to { transform: translateY(640px) rotate(300deg); opacity: 0.2 } }`}</style>
                        </div>
                    )}
                    {stamp && (
                        <div
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "grid",
                                placeItems: "center",
                                pointerEvents: "none",
                                zIndex: 6,
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: DISPLAY,
                                    fontSize: 42,
                                    color: C.green,
                                    letterSpacing: "0.02em",
                                    border: `4px solid ${C.green}`,
                                    borderRadius: 14,
                                    padding: "6px 18px",
                                    background: "rgba(255,255,255,0.92)",
                                    transform: "rotate(-8deg)",
                                    animation:
                                        "czg-stamp 1.4s ease-out forwards",
                                }}
                            >
                                go for the good.™
                            </div>
                            <style>{`@keyframes czg-stamp { 0% { opacity: 0; transform: rotate(-8deg) scale(1.6) } 20% { opacity: 1; transform: rotate(-8deg) scale(1) } 75% { opacity: 1 } 100% { opacity: 0; transform: rotate(-8deg) scale(0.98) } }`}</style>
                            </div>
                    )}

                    {/* Header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "12px 14px",
                            background: C.green,
                            color: C.white,
                            borderBottom: `3px solid ${C.ink}`,
                        }}
                    >
                        <span
                            style={{
                                background: C.cream,
                                border: `2px solid ${C.ink}`,
                                borderRadius: "50%",
                                width: 42,
                                height: 42,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                                transform: reduceMotion
                                    ? "none"
                                    : "rotate(-4deg)",
                            }}
                        >
                            <Avatar size={30} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontFamily: DISPLAY,
                                    fontSize: 24,
                                    lineHeight: 1,
                                    letterSpacing: "0.03em",
                                }}
                            >
                                THE CRAZIOLOGIST
                            </div>
                            <div
                                style={{
                                    fontSize: 12.5,
                                    opacity: 0.95,
                                    fontWeight: 600,
                                }}
                            >
                                Hours. Orders. Opinions. Occasionally macros.
                            </div>
                        </div>
                        {msgs.length > 1 && (
                            <button
                                onClick={resetChat}
                                aria-label="Start a new chat"
                                title="New chat"
                                style={{
                                    background: "transparent",
                                    border: `2px solid rgba(255,255,255,0.5)`,
                                    borderRadius: 8,
                                    color: C.white,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    padding: "4px 8px",
                                    fontFamily: FONT,
                                }}
                            >
                                New chat
                            </button>
                        )}
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close chat"
                            style={{
                                background: "transparent",
                                border: "none",
                                color: C.white,
                                fontSize: 26,
                                cursor: "pointer",
                                lineHeight: 1,
                                padding: 6,
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Promo ribbon — visible proof of the offer while it runs */}
                    {promoOn && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                padding: "8px 12px",
                                background: C.dragonfruit,
                                color: C.white,
                                borderBottom: `3px solid ${C.ink}`,
                                fontSize: 13,
                                fontWeight: 800,
                                textAlign: "center",
                            }}
                        >
                            <span>{PROMO.ribbon}</span>
                            <span
                                style={{
                                    background: C.white,
                                    color: C.dragonfruit,
                                    borderRadius: 7,
                                    padding: "2px 8px",
                                    letterSpacing: "0.08em",
                                }}
                            >
                                {PROMO.code}
                            </span>
                        </div>
                    )}

                    {/* Messages */}
                    <div
                        ref={logRef}
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            background: C.white,
                        }}
                        aria-live="polite"
                    >
                        {msgs.map((m, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems:
                                        m.role === "user"
                                            ? "flex-end"
                                            : "flex-start",
                                    gap: 4,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent:
                                            m.role === "user"
                                                ? "flex-end"
                                                : "flex-start",
                                        gap: 8,
                                        width: "100%",
                                    }}
                                >
                                    {m.role === "assistant" && (
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                marginTop: 2,
                                            }}
                                        >
                                            <Avatar size={26} />
                                        </span>
                                    )}
                                    <div
                                        style={{
                                            maxWidth: "84%",
                                            padding: "11px 15px",
                                            borderRadius: 16,
                                            fontSize: 16,
                                            lineHeight: 1.55,
                                            whiteSpace: "pre-wrap",
                                            background:
                                                m.role === "user"
                                                    ? accent
                                                    : C.cream,
                                            color: C.ink,
                                            fontWeight:
                                                m.role === "user" ? 700 : 500,
                                            border: `2px solid ${C.ink}`,
                                            borderTopLeftRadius:
                                                m.role === "assistant" ? 4 : 16,
                                            borderTopRightRadius:
                                                m.role === "user" ? 4 : 16,
                                            transform: reduceMotion
                                                ? "none"
                                                : `rotate(${m.role === "user" ? 0.4 : -0.4}deg)`,
                                        }}
                                    >
                                        {m.role === "assistant"
                                            ? renderText(m.content)
                                            : m.content}
                                    </div>
                                </div>
                                {m.role === "assistant" &&
                                    i > 0 &&
                                    !busy &&
                                    m.content.length > 0 && (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 6,
                                                paddingLeft: 34,
                                                alignItems: "center",
                                                minHeight: 20,
                                            }}
                                        >
                                            {votes[i] ? (
                                                <span
                                                    style={{
                                                        fontSize: 11.5,
                                                        color: C.ink,
                                                        opacity: 0.55,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {votes[i] === "up"
                                                        ? "Noted. The carrot takes a bow."
                                                        : "Noted. The carrot will do better."}
                                                </span>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() =>
                                                            vote(i, "up")
                                                        }
                                                        aria-label="Good answer"
                                                        style={{
                                                            background:
                                                                "transparent",
                                                            border: "none",
                                                            color: C.ink,
                                                            opacity: 0.45,
                                                            cursor: "pointer",
                                                            padding: 2,
                                                        }}
                                                        onMouseEnter={(e) =>
                                                            (e.currentTarget.style.opacity =
                                                                "1")
                                                        }
                                                        onMouseLeave={(e) =>
                                                            (e.currentTarget.style.opacity =
                                                                "0.45")
                                                        }
                                                    >
                                                        <Thumb />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            vote(i, "down")
                                                        }
                                                        aria-label="Bad answer"
                                                        style={{
                                                            background:
                                                                "transparent",
                                                            border: "none",
                                                            color: C.ink,
                                                            opacity: 0.45,
                                                            cursor: "pointer",
                                                            padding: 2,
                                                        }}
                                                        onMouseEnter={(e) =>
                                                            (e.currentTarget.style.opacity =
                                                                "1")
                                                        }
                                                        onMouseLeave={(e) =>
                                                            (e.currentTarget.style.opacity =
                                                                "0.45")
                                                        }
                                                    >
                                                        <Thumb down />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                            </div>
                        ))}
                        {showChips && (
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    paddingLeft: 34,
                                }}
                            >
                                {chips.map((c: any) =>
                                    c.href ? (
                                        <a
                                            key={c.label}
                                            href={c.href}
                                            onClick={() =>
                                                track("czg_quiz_click")
                                            }
                                            style={{
                                                background: C.lime,
                                                border: `2px solid ${C.ink}`,
                                                borderRadius: 999,
                                                padding: "8px 14px",
                                                fontFamily: FONT,
                                                fontWeight: 800,
                                                fontSize: 14,
                                                color: C.ink,
                                                cursor: "pointer",
                                                textDecoration: "none",
                                                boxShadow: `2px 2px 0 ${C.ink}`,
                                            }}
                                        >
                                            {c.label}
                                        </a>
                                    ) : (
                                        <button
                                            key={c.label}
                                            onClick={() => {
                                                track("czg_chip", {
                                                    chip: c.label,
                                                })
                                                send(c.q)
                                            }}
                                            style={{
                                                background:
                                                    promoOn &&
                                                    c.label === PROMO.chip.label
                                                        ? C.dragonfruit
                                                        : C.white,
                                                color:
                                                    promoOn &&
                                                    c.label === PROMO.chip.label
                                                        ? C.white
                                                        : C.ink,
                                                border: `2px solid ${C.ink}`,
                                                borderRadius: 999,
                                                padding: "8px 14px",
                                                fontFamily: FONT,
                                                fontWeight: 700,
                                                fontSize: 14,
                                                cursor: "pointer",
                                                boxShadow: `2px 2px 0 ${C.apricot}`,
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                        {busy && (
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        flexShrink: 0,
                                        display: "inline-block",
                                        animation: reduceMotion
                                            ? "none"
                                            : "czg-bob 1s ease-in-out infinite",
                                    }}
                                >
                                    <Avatar size={26} />
                                </span>
                                <div
                                    style={{
                                        background: C.cream,
                                        border: `2px solid ${C.ink}`,
                                        borderRadius: 16,
                                        borderTopLeftRadius: 4,
                                        padding: "11px 15px",
                                        fontSize: 15,
                                        fontStyle: "italic",
                                        color: C.ink,
                                    }}
                                >
                                    {reduceMotion
                                        ? "Thinking..."
                                        : status || IDLE_LINES[idleLine]}
                                </div>
                                <style>{`@keyframes czg-bob { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-3px) rotate(4deg) } }`}</style>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            send()
                        }}
                        style={{
                            display: "flex",
                            gap: 8,
                            padding: "10px 12px",
                            background: C.white,
                            borderTop: `3px solid ${C.ink}`,
                        }}
                    >
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={
                                promoOn
                                    ? "Catering, headcounts, the chip deal..."
                                    : "Hours, ordering, what to get..."
                            }
                            aria-label="Message the Craziologist"
                            disabled={busy}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                border: `2px solid ${C.ink}`,
                                borderRadius: 999,
                                padding: "11px 16px",
                                fontSize: 16,
                                fontFamily: FONT,
                                fontWeight: 600,
                                outline: "none",
                                color: C.ink,
                                background: C.white,
                            }}
                        />
                        <button
                            type="submit"
                            disabled={busy || !input.trim()}
                            aria-label="Send"
                            style={{
                                background: C.apricot,
                                color: C.ink,
                                border: `2px solid ${C.ink}`,
                                borderRadius: 999,
                                padding: "0 20px",
                                fontWeight: 800,
                                fontFamily: FONT,
                                fontSize: 16,
                                cursor: busy ? "wait" : "pointer",
                                opacity: busy || !input.trim() ? 0.6 : 1,
                                boxShadow: `2px 2px 0 ${C.ink}`,
                            }}
                        >
                            Send
                        </button>
                    </form>

                    {/* Footer: standing AI note; full Nutritionix disclaimer once nutrition/allergens come up */}
                    <div
                        style={{
                            padding: "7px 14px 11px",
                            background: C.white,
                            fontSize: nutritionSeen ? 10.5 : 12,
                            lineHeight: 1.5,
                            color: C.ink,
                            opacity: 0.78,
                        }}
                    >
                        {nutritionSeen ? NUTRITION_DISCLAIMER : AI_NOTE}
                    </div>
                </div>
            )}
        </div>
    )

    if (isCanvas) return widget
    if (!primary || typeof document === "undefined") return null
    return createPortal(widget, document.body)
}

addPropertyControls(CraziologistChat, {
    endpoint: {
        type: ControlType.String,
        title: "Endpoint",
        defaultValue: "https://craziologist-chat.elle-f37.workers.dev/chat",
    },
    avatar: { type: ControlType.Image, title: "Avatar" },
    startOpen: {
        type: ControlType.Boolean,
        title: "Start Open",
        defaultValue: false,
    },
    accent: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "rgb(163, 191, 30)",
    },
    offsetX: {
        type: ControlType.Number,
        title: "Right Gap",
        defaultValue: 20,
        min: 0,
        max: 80,
    },
    offsetY: {
        type: ControlType.Number,
        title: "Bottom Gap",
        defaultValue: 20,
        min: 0,
        max: 80,
    },
    appearDelay: {
        type: ControlType.Number,
        title: "Delay (s)",
        defaultValue: 10,
        min: 0,
        max: 60,
    },
    promoEnabled: {
        type: ControlType.Boolean,
        title: "Promo Layer",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    promoTeaserDelay: {
        type: ControlType.Number,
        title: "Promo Teaser (s)",
        defaultValue: 3.5,
        min: 0,
        max: 30,
        step: 0.5,
    },
})

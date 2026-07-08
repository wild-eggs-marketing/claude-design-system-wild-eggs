import { addPropertyControls, ControlType } from "framer"
import { useState, useMemo, useEffect, useRef, useDeferredValue, useReducer, useCallback, memo } from "react"

// ── 1. Constants ──────────────────────────────────────────────────────────────

const MOBILE_BP   = 680
const MAX_TRAY    = 3
const LS_KEYS     = { goal: "we_goal", sort: "we_sort", item: "we_last_item" } as const
const SS_KEY_TRAY = "we_tray"

const FIELD = {
    title:       "fIwxSF70L",
    calories:    "Du4yxFxRV",
    protein:     "mD5e0_FmL",
    carbs:       "RxAestyVQ",
    category:    "pSTF6eHFu",
    price:       "cXFi6mhII",
    ingredients: "i9pbPSUve",
    shortIngr:   "IFoMCHzs_",
    description: "GZnmQpwkD",
    thumbnail:   "o5P7Ztu2L",
} as const

// ── 2. Design tokens ──────────────────────────────────────────────────────────

// Wild Eggs site tokens — matched to the project's color styles (getProjectXml):
// Primary/Dark Teal rgb(13,79,79), Cream-Brand rgb(245,238,227), Ink rgb(28,43,28),
// Yellow rgb(246,192,52), Lime Deep rgb(123,144,21), Warm Apricot rgb(242,119,78),
// Teal Tint rgb(234,244,244).
const C = {
    orange:      "rgb(242, 119, 78)",   // Warm Apricot (site token)
    orangeDark:  "rgb(193, 71, 33)",    // AA-compliant apricot for text on white / white text on it
    orangeLight: "rgba(242, 119, 78, 0.12)",
    yellow:      "rgb(246, 192, 52)",   // Yellow (site token)
    amber:       "rgb(158, 121, 0)",    // AA-compliant stand-in for yellow as text on white
    green:       "rgb(123, 144, 21)",   // Lime Deep (site token)
    greenDark:   "rgb(90, 106, 15)",
    greenLight:  "rgba(123, 144, 21, 0.12)",
    teal:        "rgb(13, 79, 79)",     // Primary Color / Dark Teal (site token)
    tealLight:   "rgb(234, 244, 244)",  // Teal Tint (site token)
    cream:       "rgb(245, 238, 227)",  // Cream - Brand (site token)
    white:       "rgb(255, 255, 255)",
    ink:         "rgb(28, 43, 28)",     // Ink (site token)
    inkSoft:     "rgba(28, 43, 28, 0.65)",
    inkGhost:    "rgba(28, 43, 28, 0.07)",
    border:      "rgba(28, 43, 28, 0.09)",
}

// ── 3. Styles — injected once per page load ───────────────────────────────────

let _stylesInjected = false
function injectStyles() {
    if (_stylesInjected || typeof document === "undefined") return
    _stylesInjected = true
    const s = document.createElement("style")
    s.dataset.cbw = "1"
    s.textContent = `@keyframes cbwPulse{0%,100%{opacity:1}50%{opacity:0.45}}@keyframes cbwFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes cbwSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}[data-cbw-root] input[data-cbw-budget]::placeholder{color:rgba(245,238,227,0.60)}@media (prefers-reduced-motion: reduce){[data-cbw-root] *{animation:none!important;transition:none!important}}`
    document.head.appendChild(s)
}

// ── 4. Types ──────────────────────────────────────────────────────────────────

interface MenuItem {
    id:          string
    title:       string
    calories:    number
    protein:     number
    carbs:       number
    fat:         number
    category:    string
    price:       number
    ingredients: string
    shortIngr:   string
    description: string
    thumbnail:   string
    sodium:      number
    fiber:       number
    sugars:      number
    allergens:   string[]
    orderLink:   string
}

interface GoalDef {
    id:           string
    label:        string
    sub:          string
    accent:       string
    accentText?:  string   // text color on the accent fill; defaults to white
    minProtein?:  number
    maxCalories?: number
    minCarbs?:    number
}

interface FilterState {
    goal:     string
    category: string
    dietary:  string[]
    search:   string
    sortBy:   string
}

interface TrayState { items: string[]; open: boolean }
type TrayAction = { type: "TOGGLE"; id: string } | { type: "TOGGLE_OPEN" } | { type: "CLEAR" }
type FetchState  = "idle" | "loading" | "success" | "error"

interface ScaledMacros {
    protein:        number
    carbs:          number
    fat:            number
    calories:       number
    proteinDensity: number
}

// ── 5. Domain constants ───────────────────────────────────────────────────────

const PORTION_LABELS: { val: number; label: string }[] = [
    { val: 0.5, label: "Half" }, { val: 1, label: "Regular" }, { val: 1.5, label: "Large" },
]

const GOALS: GoalDef[] = [
    // "all" uses cream (not teal) — a teal fill would vanish into the teal header when active
    { id: "all",   label: "Browse All",    sub: "Full menu",     accent: C.cream, accentText: C.teal },
    // accentText is dark ink on every colored fill — white fails WCAG AA on apricot,
    // lime, and yellow; ink passes 4.5:1+ on all three site tokens.
    { id: "power", label: "Power Up",      sub: "30g+ protein",  accent: C.orange, accentText: C.ink, minProtein: 30 },
    { id: "light", label: "Keep It Light", sub: "Under 500 cal", accent: C.green,  accentText: C.ink, maxCalories: 500 },
    { id: "fuel",  label: "Fuel the Day",  sub: "Carb-forward",  accent: C.yellow, accentText: C.ink, minCarbs: 50 },
]

// Dietary predicates — powered by the machine-readable MenuTrinfo allergen strings
// on each CMS item (e.g. "egg|milk|wheat"), not keyword inference. Allergen-absence
// claims only fire for items whose nutrition analysis exists (calories > 0):
// an unanalyzed item with an empty allergen list is unknown, not allergen-free.
const noAllergen = (i: MenuItem, ...keys: string[]): boolean =>
    i.calories > 0 && !keys.some(k => i.allergens.includes(k))

const DIETARY_TAGS: Record<string, (i: MenuItem) => boolean> = {
    "Gluten-Friendly": i => noAllergen(i, "wheat"),
    "Dairy-Free":      i => noAllergen(i, "milk"),
    "Egg-Free":        i => noAllergen(i, "egg"),
    "Nut-Free":        i => noAllergen(i, "peanuts", "tree_nuts"),
    "High Protein":    i => i.protein >= 25,
    "Low Carb":        i => i.carbs > 0 && i.carbs <= 20,
}

const DIETARY: string[] = Object.keys(DIETARY_TAGS)

// Deliberate menu order for "Browse All" (no goal to rank by) so the default view
// reads as curated rather than raw data order. Unknown categories sort last.
const CATEGORY_ORDER = ["Bonnie's Bennies", "Breakfast Mains", "Pancakes, Waffles & Sweets", "Lunch & Sandwiches", "Kids Menu", "Sides", "Drinks & Cocktails", "Gluten-friendly", "Catering"]
const catRank = (c: string): number => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 99 : i }

// ── 6. Storage factory ────────────────────────────────────────────────────────

function createStorage(type: "local" | "session") {
    const store = () => type === "local" ? localStorage : sessionStorage
    const ok    = () => typeof window !== "undefined"
    return {
        get: (key: string): string | null   => { try { return ok() ? store().getItem(key) : null } catch { return null } },
        set: (key: string, val: string): void => { try { if (ok()) store().setItem(key, val) }  catch { /* noop */ } },
        del: (key: string): void              => { try { if (ok()) store().removeItem(key) }    catch { /* noop */ } },
    }
}

const ls = createStorage("local")
const ss = createStorage("session")

// ── 7. Utilities ──────────────────────────────────────────────────────────────

// Matches "Thai Wrap" / "Thai Bowl" style titles for wrap-or-bowl pairing.
const FORMAT_RE = /^(.*)\s+(Wrap|Bowl)$/

// framerusercontent serves resized renditions via ?scale-down-to — cards never
// need the full-resolution upload.
// Build-your-own items can never have fixed nutrition — their macros depend on
// what the guest picks. They get "varies" copy instead of "coming soon".
const BYO_RE = /build your own|create your own/i
const isBYO = (i: MenuItem): boolean => BYO_RE.test(i.title)

function scaledSrc(url: string, px: number): string {
    if (!url || !url.includes("framerusercontent.com")) return url
    return url + (url.includes("?") ? "&" : "?") + "scale-down-to=" + px
}

function fitScore(item: MenuItem, goalId: string): number {
    if (goalId === "power") return item.protein
    if (goalId === "light") return item.calories > 0 ? 1000 / item.calories : 0
    if (goalId === "fuel")  return item.carbs
    return 0
}

// Unwraps Framer CMS { type, value } envelope; returns value unchanged otherwise.
function unwrapFramer(v: unknown): unknown {
    if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>))
        return (v as Record<string, unknown>).value
    return v
}

// Maps any CMS response shape to a MenuItem.
// Priority 1: Framer CMS field IDs (with optional { type, value } wrappers).
// Priority 2: Human-readable keys from flat JSON APIs.
function mapCmsItem(raw: Record<string, unknown>, index: number): MenuItem {
    const fd  = (raw.fieldData ?? raw) as Record<string, unknown>
    const pick = (...keys: string[]): unknown => {
        for (const k of keys) {
            const v = unwrapFramer(fd[k])
            if (v !== undefined && v !== null && v !== "") return v
        }
        return undefined
    }
    const str = (...keys: string[]): string => String(pick(...keys) ?? "")
    const num = (...keys: string[]): number => Number(pick(...keys)) || 0

    return {
        id:          String(raw.id ?? raw.slug ?? index),
        title:       str(FIELD.title, "title", "name", "Title", "Name"),
        calories:    num(FIELD.calories, "calories", "Calories", "cal"),
        protein:     num(FIELD.protein,  "protein",  "Protein"),
        carbs:       num(FIELD.carbs,    "carbs",    "Carbs", "carbohydrates"),
        fat:         num("fat", "Fat"),
        category:    str(FIELD.category, "category", "Category", "type", "Type"),
        price:       num(FIELD.price, "price", "Price"),
        ingredients: str(FIELD.ingredients, "ingredients", "Ingredients"),
        shortIngr:   str(FIELD.shortIngr, "shortIngr", "shortIngredients", "short_ingredients"),
        description: str(FIELD.description, "description", "Description"),
        thumbnail:   str(FIELD.thumbnail, "thumbnail", "Thumbnail", "image", "Image", "photo"),
        sodium:      num("sodium", "Sodium"),
        fiber:       num("fiber", "Fiber"),
        sugars:      num("sugars", "Sugars"),
        allergens:   Array.isArray(fd.allergens) ? (fd.allergens as string[]) : [],
        orderLink:   str("orderLink", "orderUrl", "order_link"),
    }
}

// ── 7b. Baked-in menu data ────────────────────────────────────────────────────
// Snapshot of the "Menu Items" CMS collection (138 items, MenuTrinfo April 2024).
// Used when no items prop / cmsEndpoint is provided, so the component works the
// moment it's dropped on a page. Re-export from the CMS to refresh.

// ── 8. Reducer ────────────────────────────────────────────────────────────────

function trayReducer(state: TrayState, action: TrayAction): TrayState {
    switch (action.type) {
        case "TOGGLE": {
            if (state.items.includes(action.id)) {
                const next = state.items.filter(t => t !== action.id)
                return { items: next, open: next.length > 0 ? state.open : false }
            }
            if (state.items.length >= MAX_TRAY) return state
            return { ...state, items: [...state.items, action.id] }
        }
        case "TOGGLE_OPEN": return { ...state, open: !state.open }
        case "CLEAR":       return { items: [], open: false }
        default: return state
    }
}

// ── 9. Pure filter logic ──────────────────────────────────────────────────────

// Single source of truth for goal-matching — used by both applyFilters and buildGoalCounts.
const NON_MEAL_CATEGORIES = new Set(["Drinks & Cocktails", "Catering"])

function filterByGoal(items: MenuItem[], g: GoalDef): MenuItem[] {
    // Goals rank dishes; without this, "Keep It Light" crowns Sweet Tea (5 cal)
    // best match and buries every actual meal.
    let list = g.id !== "all" ? items.filter(i => !NON_MEAL_CATEGORIES.has(i.category)) : items
    if (g.minProtein  !== undefined) list = list.filter(i => i.protein  >= g.minProtein!)
    // calories > 0 guard: items with missing nutrition data (0 cal) must not pass a calorie cap
    if (g.maxCalories !== undefined) list = list.filter(i => i.calories > 0 && i.calories <= g.maxCalories!)
    if (g.minCarbs    !== undefined) list = list.filter(i => i.carbs    >= g.minCarbs!)
    return list
}

function applyFilters(items: MenuItem[], f: FilterState): MenuItem[] {
    const g    = GOALS.find(g => g.id === f.goal)
    let   list = g ? filterByGoal(items, g) : items
    if (f.category !== "All") list = list.filter(i => i.category === f.category)
    const q = f.search.trim().toLowerCase()
    if (q) list = list.filter(i => i.title.toLowerCase().includes(q) || i.ingredients.toLowerCase().includes(q))
    if (f.dietary.length > 0) list = list.filter(i => f.dietary.every(d => DIETARY_TAGS[d]?.(i) ?? true))
    if (f.sortBy === "calories-asc")  return [...list].sort((a, b) => a.calories - b.calories)
    if (f.sortBy === "calories-desc") return [...list].sort((a, b) => b.calories - a.calories)
    if (f.sortBy === "protein-desc")  return [...list].sort((a, b) => b.protein  - a.protein)
    if (f.sortBy === "goal-fit") {
        // On Browse All there's no goal to rank by — fall back to curated category order
        // (stable sort preserves within-category menu order) instead of raw data order.
        if (f.goal === "all") return [...list].sort((a, b) => catRank(a.category) - catRank(b.category))
        return [...list].sort((a, b) => fitScore(b, f.goal) - fitScore(a, f.goal))
    }
    return list
}

// ── 10. Custom hooks ──────────────────────────────────────────────────────────

// Stores a boolean (not raw pixel width) so React's bail-out suppresses renders
// when the breakpoint hasn't changed. Debounced at 100ms to cap resize frequency.
function useViewport(): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        try { return typeof window !== "undefined" ? window.innerWidth < MOBILE_BP : false } catch { return false }
    })
    useEffect(() => {
        if (typeof window === "undefined") return
        let timer: ReturnType<typeof setTimeout>
        function onResize() {
            clearTimeout(timer)
            timer = setTimeout(() => { try { setIsMobile(window.innerWidth < MOBILE_BP) } catch { /* noop */ } }, 100)
        }
        window.addEventListener("resize", onResize)
        return () => { clearTimeout(timer); window.removeEventListener("resize", onResize) }
    }, [])
    return isMobile
}

// Reads URL params once on mount; writes back on state changes.
function useUrlSync(
    state: { goal: string; category: string; sortBy: string; selected: string | null },
    onMountCb: (p: { goal?: string; category?: string; sortBy?: string; item?: string }) => void
): void {
    const mounted      = useRef(false)
    const onMountRef   = useRef(onMountCb)
    onMountRef.current = onMountCb

    useEffect(() => {
        if (mounted.current) return
        mounted.current = true
        try {
            if (typeof window === "undefined") return
            const p = new URLSearchParams(window.location.search)
            onMountRef.current({ goal: p.get("goal") ?? undefined, category: p.get("category") ?? undefined, sortBy: p.get("sort") ?? undefined, item: p.get("item") ?? undefined })
        } catch { /* noop */ }
    }, [])

    useEffect(() => {
        try {
            if (typeof window === "undefined") return
            const p = new URLSearchParams(window.location.search)
            if (state.goal && state.goal !== "all") { p.set("goal", state.goal) } else { p.delete("goal") }
            if (state.category && state.category !== "All") { p.set("category", state.category) } else { p.delete("category") }
            if (state.sortBy && state.sortBy !== "goal-fit") { p.set("sort", state.sortBy) } else { p.delete("sort") }
            if (state.selected) { p.set("item", state.selected) } else { p.delete("item") }
            const qs = p.toString()
            history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
        } catch { /* noop */ }
    }, [state.goal, state.category, state.sortBy, state.selected])
}

function useKeyboard(key: string, handler: () => void): void {
    const handlerRef   = useRef(handler)
    handlerRef.current = handler
    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key.toLowerCase() === key.toLowerCase()) handlerRef.current() }
        if (typeof window === "undefined") return
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [key])
}

// ── 11. Primitive components ──────────────────────────────────────────────────

const MacroBar = memo(function MacroBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
    return (
        <div style={{ height: 3, background: C.inkGhost, borderRadius: 2, overflow: "hidden", flex: 1 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.3s ease" }} />
        </div>
    )
})

interface MacroRingProps { protein: number; carbs: number; fat: number; calories: number; size?: number }
const MacroRing = memo(function MacroRing({ protein, carbs, fat, calories, size = 140 }: MacroRingProps) {
    const total  = protein * 4 + carbs * 4 + fat * 9
    const r = 40, sw = 9, circ = 2 * Math.PI * r
    const proLen = total > 0 ? (protein * 4 / total) * circ : 0
    const carLen = total > 0 ? (carbs   * 4 / total) * circ : 0
    const fatLen = total > 0 ? (fat     * 9 / total) * circ : 0
    const arc    = { transition: "stroke-dasharray 0.45s ease, stroke-dashoffset 0.45s ease" }
    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", display: "block" }}>
                <circle cx="50" cy="50" r={r} fill="none" stroke={C.inkGhost} strokeWidth={sw} />
                <circle cx="50" cy="50" r={r} fill="none" stroke={C.orange} strokeWidth={sw} strokeDasharray={`${proLen} ${circ}`} strokeDashoffset={0} strokeLinecap="round" style={arc} />
                <circle cx="50" cy="50" r={r} fill="none" stroke={C.yellow} strokeWidth={sw} strokeDasharray={`${carLen} ${circ}`} strokeDashoffset={-proLen} strokeLinecap="round" style={arc} />
                <circle cx="50" cy="50" r={r} fill="none" stroke={C.green}  strokeWidth={sw} strokeDasharray={`${fatLen} ${circ}`} strokeDashoffset={-(proLen + carLen)} strokeLinecap="round" style={arc} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{calories}</span>
                <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>cal</span>
            </div>
        </div>
    )
})

const MacroStat = memo(function MacroStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{value}<span style={{ fontSize: 12, fontWeight: 600 }}>{unit}</span></div>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
            </div>
        </div>
    )
})

const GoalButton = memo(function GoalButton({ g, active, count, total, onClick }: { g: GoalDef; active: boolean; count: number; total: number; onClick: () => void }) {
    const isEmpty = total > 0 && count === 0
    return (
        <button onClick={onClick} aria-pressed={active} style={{
            padding: "11px 18px", borderRadius: 10,
            border: `1.5px solid ${active ? g.accent : isEmpty ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)"}`,
            background: active ? g.accent : isEmpty ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
            color: active ? (g.accentText ?? C.white) : isEmpty ? "rgba(245,238,227,0.35)" : "rgba(245,238,227,0.80)",
            cursor: isEmpty ? "default" : "pointer", textAlign: "left", transition: "all 0.15s", minWidth: 110, fontFamily: "inherit"
        }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{g.label}</div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 3 }}>{active ? `${count} items` : isEmpty ? "none available" : g.sub}</div>
        </button>
    )
})

const SkeletonCard = memo(function SkeletonCard() {
    return (
        <div style={{ background: C.white, borderRadius: 12, overflow: "hidden", border: "2px solid transparent" }}>
            <div style={{ height: 140, background: C.inkGhost, animation: "cbwPulse 1.6s ease-in-out infinite" }} />
            <div style={{ padding: "11px 13px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ height: 13, borderRadius: 4, background: C.inkGhost, width: "72%", animation: "cbwPulse 1.6s ease-in-out infinite 0.1s" }} />
                <div style={{ height: 10, borderRadius: 4, background: C.inkGhost, width: "90%", animation: "cbwPulse 1.6s ease-in-out infinite 0.2s" }} />
                <div style={{ height: 10, borderRadius: 4, background: C.inkGhost, width: "55%", animation: "cbwPulse 1.6s ease-in-out infinite 0.3s" }} />
            </div>
        </div>
    )
})

function Highlight({ text, query }: { text: string; query: string }) {
    const q = query.trim().toLowerCase()
    if (!q) return <>{text}</>
    const idx = text.toLowerCase().indexOf(q)
    if (idx === -1) return <>{text}</>
    return <>{text.slice(0, idx)}<mark style={{ background: C.yellow, color: C.ink, borderRadius: 2, padding: "0 1px", fontWeight: 800 }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>
}

// ── 12. Main component ────────────────────────────────────────────────────────

interface WildEggsNutritionCalculatorProps {
    items?:       MenuItem[]
    cmsEndpoint?: string
    apiKey?:      string
    orderUrl?:    string
    fontFamily?:  string
    stickyOffset?: number
}

function WildEggsNutritionCalculator({
    items = [],
    cmsEndpoint = "https://wild-eggs-nutrition-calculator.elle-f37.workers.dev/",
    apiKey      = "",
    orderUrl    = "#",
    fontFamily  = "Bricolage Grotesque, sans-serif",
    stickyOffset = 96,
}: WildEggsNutritionCalculatorProps) {

    // — State ——————————————————————————————————————————————————————————————————
    const [goal,       setGoal]       = useState<string>(() => ls.get(LS_KEYS.goal) ?? "all")
    // Sort is intentionally NOT persisted across sessions — every visit starts on
    // "Best Goal Fit" so a previously-chosen sort can't silently reorder the menu.
    const [sortBy,     setSortBy]     = useState<string>("goal-fit")
    const [category,   setCategory]   = useState<string>("All")
    const [dietary,    setDietary]    = useState<string[]>([])
    const [search,     setSearch]     = useState<string>("")
    const [selected,   setSelected]   = useState<string | null>(() => ls.get(LS_KEYS.item))
    const [portion,    setPortion]    = useState<number>(1)
    // Persisted so a returning guest keeps their daily calorie budget (sane-range guard).
    const [budget,     setBudget]     = useState<number>(() => { const v = Number(ls.get("we-budget") ?? 0); return v >= 500 && v <= 6000 ? v : 0 })
    const [showMacros, setShowMacros] = useState<boolean>(true)
    const [cmsItems,   setCmsItems]   = useState<MenuItem[]>([])
    const [fetchState, setFetchState] = useState<FetchState>("idle")
    const [retryKey,   setRetryKey]   = useState<number>(0)
    const [copied,     setCopied]     = useState<boolean>(false)
    // Per-flavor format choice for merged wrap/bowl cards (flavor key -> chosen item id)
    const [fmtSel,     setFmtSel]     = useState<Record<string, string>>({})

    const [trayState, trayDispatch] = useReducer(trayReducer, undefined, () => {
        try { const s = ss.get(SS_KEY_TRAY); if (s) return { items: JSON.parse(s) as string[], open: false } } catch { /* noop */ }
        return { items: [] as string[], open: false }
    })

    const deferredSearch  = useDeferredValue(search)
    const isSearchPending = search !== deferredSearch
    const isMobile        = useViewport()

    const hasRealPropItems = items.some(i => i.title.trim() !== "")
    const effectiveItems   = hasRealPropItems ? items : cmsItems

    // — Stable callbacks ———————————————————————————————————————————————————————
    // On close, return focus to the originating card (WCAG 2.4.3 focus order).
    const handleClose      = useCallback(() => {
        setSelected(prev => {
            if (prev && typeof document !== "undefined") {
                const el = document.querySelector<HTMLElement>(`[data-cbw-open="${CSS.escape(prev)}"]`)
                if (el) setTimeout(() => el.focus(), 0)
            }
            return null
        })
    }, [])
    const handleDeepLink   = useCallback((id: string) => setSelected(id), [])
    const handleToggleTray = useCallback((id: string) => trayDispatch({ type: "TOGGLE", id }), [])
    // Re-clicking the active goal deselects it (back to Browse All) — every filter must be un-clickable in place.
    const handleGoalClick  = useCallback((id: string) => setGoal(prev => prev === id && id !== "all" ? "all" : id), [])

    const urlMountCb = useCallback(({ goal: g, category: cat, sortBy: s, item }: { goal?: string; category?: string; sortBy?: string; item?: string }) => {
        const validGoal = GOALS.find(x => x.id === g)
        if (validGoal) setGoal(validGoal.id)
        if (cat)  setCategory(cat)
        if (s && s !== "default") setSortBy(s)
        if (item) handleDeepLink(item)
    }, [handleDeepLink])

    useUrlSync({ goal, category, sortBy, selected }, urlMountCb)

    // — Effects ————————————————————————————————————————————————————————————————
    useEffect(() => { injectStyles() }, [])
    useEffect(() => { ls.set(LS_KEYS.goal, goal) },    [goal])
    useEffect(() => { selected ? ls.set(LS_KEYS.item, selected) : ls.del(LS_KEYS.item) }, [selected])
    useEffect(() => { setPortion(1); setCopied(false) }, [selected])
    useEffect(() => { budget > 0 ? ls.set("we-budget", String(budget)) : ls.del("we-budget") }, [budget])

    // Auto-reset the "Copied!" confirmation after 2s
    useEffect(() => {
        if (!copied) return
        const t = setTimeout(() => setCopied(false), 2000)
        return () => clearTimeout(t)
    }, [copied])
    useEffect(() => { ss.set(SS_KEY_TRAY, JSON.stringify(trayState.items)) }, [trayState.items])

    // Lock page scroll behind the mobile bottom sheet
    useEffect(() => {
        if (typeof document === "undefined" || !isMobile || !selected) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [isMobile, selected])

    // Clears a stale `selected` (from localStorage) when items load and the ID no longer exists.
    useEffect(() => {
        if (effectiveItems.length > 0 && selected && !effectiveItems.find(i => i.id === selected || i.title === selected)) {
            setSelected(null)
        }
    }, [effectiveItems]) // intentionally omits `selected` — only runs when items change

    // CMS fetch — supports pagination via nextCursor; retryKey triggers re-fetch on Retry click.
    useEffect(() => {
        if (!cmsEndpoint || hasRealPropItems) return
        let cancelled = false
        setFetchState("loading")

        async function fetchAll(): Promise<Record<string, unknown>[]> {
            const headers: Record<string, string> = { Accept: "application/json" }
            if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
            const all: Record<string, unknown>[] = []
            let url: string | null = cmsEndpoint
            while (url) {
                const r = await fetch(url, { headers })
                if (!r.ok) throw new Error(String(r.status))
                const data = await r.json() as Record<string, unknown>
                const page: Record<string, unknown>[] =
                    Array.isArray(data)       ? data as Record<string, unknown>[] :
                    Array.isArray(data.items) ? data.items as Record<string, unknown>[] :
                    Array.isArray(data.data)  ? data.data  as Record<string, unknown>[] : []
                all.push(...page)
                url = typeof data.nextCursor === "string"
                    ? `${cmsEndpoint}${cmsEndpoint.includes("?") ? "&" : "?"}cursor=${data.nextCursor}`
                    : null
            }
            return all
        }

        fetchAll()
            .then(raw => {
                if (cancelled) return
                setCmsItems(raw.map((r, i) => mapCmsItem(r, i)).filter(i => i.title.trim() !== ""))
                setFetchState("success")
            })
            .catch(() => { if (!cancelled) setFetchState("error") })
        return () => { cancelled = true }
    }, [cmsEndpoint, hasRealPropItems, apiKey, retryKey])

    // useKeyboard stabilises the handler internally via a ref — no useCallback needed here.
    useKeyboard("Escape", handleClose)
    useKeyboard("c", () => {
        const tag = typeof document !== "undefined" ? (document.activeElement?.tagName ?? "") : ""
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
        if (trayState.items.length > 0) trayDispatch({ type: "TOGGLE_OPEN" })
    })

    // — Derived data ———————————————————————————————————————————————————————————
    // Wrap-or-bowl pairing: flavors sold as both (e.g. "Thai Wrap"/"Thai Bowl") merge
    // into one card with a format toggle. Items stay separate in the data so each
    // format keeps its own verified nutrition and goal filters stay per-format.
    const pairMap = useMemo(() => {
        const m = new Map<string, { wrap?: MenuItem; bowl?: MenuItem }>()
        effectiveItems.forEach(i => {
            const match = FORMAT_RE.exec(i.title)
            if (!match) return
            const key = match[1].toLowerCase()
            const e = m.get(key) ?? {}
            if (match[2] === "Wrap") e.wrap = i; else e.bowl = i
            m.set(key, e)
        })
        for (const [k, v] of Array.from(m)) if (!v.wrap || !v.bowl) m.delete(k)
        return m as Map<string, { wrap: MenuItem; bowl: MenuItem }>
    }, [effectiveItems])

    // Count merged cards, not raw items, so pill/goal counts match what the grid shows
    const countCards = useCallback((list: MenuItem[]): number => {
        let n = list.length
        const ids = new Set(list.map(i => i.id))
        pairMap.forEach(p => { if (ids.has(p.wrap.id) && ids.has(p.bowl.id)) n-- })
        return n
    }, [pairMap])

    const goalCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        GOALS.forEach(g => { counts[g.id] = countCards(filterByGoal(effectiveItems, g)) })
        return counts
    }, [effectiveItems, countCards])

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: countCards(effectiveItems) }
        const byCat = new Map<string, MenuItem[]>()
        effectiveItems.forEach(i => { if (i.category) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]) })
        byCat.forEach((list, cat) => { counts[cat] = countCards(list) })
        return counts
    }, [effectiveItems, countCards])
    const categories     = useMemo(() => ["All", ...Array.from(new Set(effectiveItems.map(i => i.category).filter(Boolean)))], [effectiveItems])

    const { maxProtein, maxCarbs } = useMemo(() => ({
        maxProtein: effectiveItems.reduce((m, i) => Math.max(m, i.protein),  1),
        maxCarbs:   effectiveItems.reduce((m, i) => Math.max(m, i.carbs),    1),
    }), [effectiveItems])

    const { filtered, maxScore } = useMemo(() => {
        const f  = applyFilters(effectiveItems, { goal, category, dietary, search: deferredSearch, sortBy })
        const ms = goal !== "all" && f.length > 0 ? f.reduce((m, i) => Math.max(m, fitScore(i, goal)), 1) : 1
        return { filtered: f, maxScore: ms }
    }, [effectiveItems, goal, category, dietary, deferredSearch, sortBy])

    const { trayItems, trayTotals } = useMemo(() => {
        const ti = trayState.items.map(id => effectiveItems.find(i => i.id === id || i.title === id)).filter((x): x is MenuItem => !!x)
        return {
            trayItems: ti,
            trayTotals: {
                calories: ti.reduce((s, i) => s + i.calories, 0),
                protein:  ti.reduce((s, i) => s + i.protein,  0),
                carbs:    ti.reduce((s, i) => s + i.carbs,    0),
                price:    ti.reduce((s, i) => s + i.price,    0),
            },
        }
    }, [trayState.items, effectiveItems])

    const sel = useMemo(() => selected ? effectiveItems.find(i => i.id === selected || i.title === selected) : undefined, [selected, effectiveItems])

    interface CardEntry { item: MenuItem; partner?: MenuItem; key: string }
    const cards = useMemo((): CardEntry[] => {
        const seen = new Set<string>()
        const out: CardEntry[] = []
        const inFiltered = new Set(filtered.map(i => i.id))
        for (const item of filtered) {
            const match = FORMAT_RE.exec(item.title)
            const key = match ? match[1].toLowerCase() : ""
            const pair = key ? pairMap.get(key) : undefined
            if (pair) {
                if (seen.has(key)) continue
                seen.add(key)
                const partner = item.id === pair.wrap.id ? pair.bowl : pair.wrap
                // Merge only when the partner also passes the active filters
                out.push({ item, partner: inFiltered.has(partner.id) ? partner : undefined, key })
            } else {
                out.push({ item, key: item.id })
            }
        }
        return out
    }, [filtered, pairMap])

    // The paired counterpart of the currently selected item, for the detail-panel toggle
    const selAlt = useMemo((): MenuItem | undefined => {
        if (!sel) return undefined
        const match = FORMAT_RE.exec(sel.title)
        if (!match) return undefined
        const pair = pairMap.get(match[1].toLowerCase())
        if (!pair) return undefined
        return sel.id === pair.wrap.id ? pair.bowl : pair.wrap
    }, [sel, pairMap])

    const scaled = useMemo((): ScaledMacros => {
        if (!sel) return { protein: 0, carbs: 0, fat: 0, calories: 0, proteinDensity: 0 }
        const protein  = Math.round(sel.protein  * portion)
        const carbs    = Math.round(sel.carbs    * portion)
        const fat      = Math.round(sel.fat      * portion)
        const calories = Math.round(sel.calories * portion)
        return { protein, carbs, fat, calories, proteinDensity: calories > 0 ? Math.round((protein / calories) * 100) : 0 }
    }, [sel, portion])

    const swapTip = useMemo((): string | null => {
        if (!sel) return null
        if (goal === "power" && scaled.protein  < 30)  return "Add an egg or a side of turkey sausage to push protein past 30g."
        if (goal === "light" && scaled.calories > 500) return "Swap home fries for fresh fruit or split the dish to stay under 500 cal."
        if (goal === "fuel"  && scaled.carbs    < 50)  return "Add a buttermilk pancake or an Everything muffin to hit your carb target."
        return null
    }, [sel, goal, scaled])

    // Same-goal "you might also like" — up to 3 items that match the active goal
    // (or share the category on Browse All), ranked by goal fit, wrap/bowl deduped.
    const suggestions = useMemo((): MenuItem[] => {
        if (!sel) return []
        const g = GOALS.find(x => x.id === goal)
        const base = g && goal !== "all" ? filterByGoal(effectiveItems, g) : effectiveItems.filter(i => i.category === sel.category)
        const excl = new Set([sel.id, selAlt?.id].filter(Boolean) as string[])
        const pool = base.filter(i => !excl.has(i.id) && i.calories > 0)
        const ranked = goal !== "all" ? [...pool].sort((a, b) => fitScore(b, goal) - fitScore(a, goal)) : pool
        const seen = new Set<string>(); const out: MenuItem[] = []
        for (const i of ranked) {
            const m = FORMAT_RE.exec(i.title); const key = m ? m[1].toLowerCase() : i.id
            if (seen.has(key)) continue
            seen.add(key); out.push(i)
            if (out.length === 3) break
        }
        return out
    }, [sel, selAlt, effectiveItems, goal])

    // — Convenience ————————————————————————————————————————————————————————————
    const budgetRemaining = budget > 0 ? budget - trayTotals.calories : null
    const activeFilters   = dietary.length + (category !== "All" ? 1 : 0) + (search ? 1 : 0)
    const noItems         = effectiveItems.length === 0
    const isLoading       = fetchState === "loading"
    const isError         = fetchState === "error"
    const padX            = isMobile ? 16 : 32   // responsive gutters — 32px was cramped on phones

    // Scented dietary filters: what each pill would yield if toggled ON given every
    // other active filter — surfaces impossible combos (e.g. Low Carb × Fuel the Day)
    // as (0) BEFORE the tap instead of a dead-end empty state.
    const dietaryCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        DIETARY.forEach(d => {
            const withPill = Array.from(new Set([...dietary, d]))
            counts[d] = countCards(applyFilters(effectiveItems, { goal, category, dietary: withPill, search: deferredSearch, sortBy: "" }))
        })
        return counts
    }, [effectiveItems, goal, category, dietary, deferredSearch, countCards])
    // Desktop: detail is an in-flow sticky column beside the grid (stays inside the
    // component, never covers the site header, keeps the catalog visible — the
    // research-backed split-view pattern). Mobile: a bottom sheet.
    const detailColStyle = {
        width: 380, flexShrink: 0, alignSelf: "stretch" as const,
        // Offset below the site's floating nav so it never overlaps the panel's
        // close button (nav height + breathing room, tunable per-site in Framer).
        position: "sticky" as const, top: stickyOffset, maxHeight: `calc(100vh - ${stickyOffset}px)`,
        overflowY: "auto" as const, background: C.white,
        borderLeft: `1px solid ${C.border}`, boxShadow: "-4px 0 24px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column" as const,
        animation: "cbwFadeUp 0.2s ease",
    }
    const sheetStyle = {
        position: "fixed" as const, left: 0, right: 0, bottom: 0, zIndex: 200,
        maxHeight: "86vh", background: C.white,
        borderRadius: "18px 18px 0 0", overflowY: "auto" as const,
        display: "flex", flexDirection: "column" as const,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)", animation: "cbwSheetUp 0.28s ease",
    }

    // Shared detail content — rendered in the desktop column and the mobile sheet.
    const detailInner = sel ? (
        <>
            <div style={{ height: isMobile ? 170 : 200, background: C.inkGhost, position: "relative", flexShrink: 0 }}>
                {isMobile && <div aria-hidden="true" style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.7)", zIndex: 2 }} />}
                {(sel.thumbnail || selAlt?.thumbnail)
                    ? <img src={sel.thumbnail || selAlt!.thumbnail} alt={sel.title} onError={e => { const el = e.currentTarget; const fb = selAlt?.thumbnail; if (fb && el.src !== fb) { el.src = fb } else { el.style.display = "none" } }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div aria-hidden="true" style={{ width: "100%", height: "100%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 800, color: C.teal, opacity: 0.55 }}>{sel.title.charAt(0)}</div>}
                <button onClick={handleClose} aria-label="Close detail panel" style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none", cursor: "pointer", fontSize: 16, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
                {scaled.proteinDensity > 0 && <div style={{ position: "absolute", bottom: 12, left: 12, background: scaled.proteinDensity >= 8 ? C.greenDark : C.teal, color: C.white, fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 8, letterSpacing: "0.06em" }}>{scaled.proteinDensity}g protein / 100 cal</div>}
            </div>
            <div style={{ padding: "18px 20px 36px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                <div>
                    <h3 style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: "0 0 3px", lineHeight: 1.2 }}>{sel.title}</h3>
                    {sel.category && <div style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.12em" }}>{sel.category}</div>}
                </div>
                {trayState.items.length > 0 && (
                    <button onClick={() => trayDispatch({ type: "TOGGLE_OPEN" })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: C.tealLight, border: `1px solid ${C.teal}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.06em" }}>Comparing {trayState.items.length}</span>
                        <span style={{ fontSize: 11, color: C.ink, fontWeight: 600 }}>{trayTotals.calories} cal · {trayTotals.protein}g pro</span>
                    </button>
                )}
                {selAlt && (
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 6 }}>Format</div>
                        <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Wrap or bowl">
                            {[sel, selAlt].sort((a, b) => (a.title.endsWith("Wrap") ? 0 : 1) - (b.title.endsWith("Wrap") ? 0 : 1)).map(v => {
                                const active = v.id === sel.id
                                return (
                                    <button key={v.id} onClick={() => setSelected(v.id)} aria-pressed={active}
                                        style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", border: `1.5px solid ${active ? C.teal : C.border}`, background: active ? C.tealLight : "transparent", color: active ? C.teal : C.inkSoft }}>
                                        {v.title.endsWith("Wrap") ? "Wrap" : "Bowl"}{v.price > 0 ? ` · $${v.price.toFixed(2)}` : ""}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
                {sel.calories > 0 ? (
                    <>
                        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px", background: C.inkGhost, borderRadius: 12 }}>
                            <MacroRing protein={scaled.protein} carbs={scaled.carbs} fat={scaled.fat} calories={scaled.calories} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <MacroStat label="Protein" value={scaled.protein} unit="g" color={C.orange} />
                                <MacroStat label="Carbs"   value={scaled.carbs}   unit="g" color={C.yellow} />
                                {scaled.fat > 0 && <MacroStat label="Fat" value={scaled.fat} unit="g" color={C.green} />}
                                {sel.sodium > 0 && <MacroStat label="Sodium" value={Math.round(sel.sodium * portion)} unit="mg" color={C.teal} />}
                            </div>
                        </div>
                    </>
                ) : (
                    // Zero-data guard: never show an empty 0-cal macro ring — mirror the
                    // card-level "nutrition coming soon" state instead.
                    <div style={{ padding: "16px 14px", background: C.inkGhost, borderRadius: 12, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{isBYO(sel) ? "Nutrition depends on your choices" : "Nutrition analysis coming soon"}</div>
                        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>{isBYO(sel) ? "Every combination is different — build it your way and ask our staff about any ingredient or allergen." : "This item is pending lab analysis. Ask our staff about ingredients and allergens."}</div>
                    </div>
                )}
                {budget > 0 && scaled.calories > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderRadius: 10, background: C.tealLight, border: `1px solid ${C.teal}` }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>This dish</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{scaled.calories} cal</span>
                        <span style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>{Math.round((scaled.calories / budget) * 100)}% of daily goal</span>
                    </div>
                )}
                {goal !== "all" && sel.calories > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, background: swapTip ? C.orangeLight : C.greenLight, borderLeft: `3px solid ${swapTip ? C.orange : C.green}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: swapTip ? C.orangeDark : C.greenDark, textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 58 }}>{swapTip ? "Tweak it" : "Great fit"}</div>
                        <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{swapTip ?? "This item aligns well with your " + (GOALS.find(g => g.id === goal)?.label ?? "") + " goal."}</div>
                    </div>
                )}
                {sel.description && <p style={{ fontSize: 13, color: C.inkSoft, margin: 0, lineHeight: 1.7 }}>{sel.description}</p>}
                {sel.ingredients && (
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 5 }}>Ingredients</div>
                        <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.75, opacity: 0.75 }}>{sel.ingredients}</div>
                    </div>
                )}
                {suggestions.length > 0 && (
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 8 }}>{goal !== "all" ? `More ${GOALS.find(g => g.id === goal)?.label ?? ""} picks` : "You might also like"}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {suggestions.map(s => (
                                <button key={s.id} onClick={() => setSelected(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 6, borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: C.inkGhost }}>
                                        {s.thumbnail && <img src={scaledSrc(s.thumbnail, 128)} alt="" role="presentation" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title.replace(/ (Wrap|Bowl)$/, "")}</div>
                                        <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: s.calories > 0 ? "normal" : "italic" }}>{s.calories > 0 ? `${s.calories} cal · ${s.protein}g pro` : (isBYO(s) ? "varies by your picks" : "nutrition coming soon")}</div>
                                    </div>
                                    <span aria-hidden="true" style={{ fontSize: 14, color: C.inkSoft, flexShrink: 0 }}>›</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                    <a href={sel.orderLink || orderUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "14px", borderRadius: 10, background: C.orangeDark, color: C.white, fontWeight: 700, fontSize: 14, textDecoration: "none", fontFamily: "inherit", letterSpacing: "0.01em" }}>{sel.price > 0 ? `Order Now — $${sel.price.toFixed(2)}` : "Order Now"}</a>
                    <button onClick={() => { try { if (typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.set("item", sel.id); navigator.clipboard?.writeText(url.toString()); setCopied(true) } } catch { /* noop */ } }} aria-live="polite" style={{ padding: "11px", borderRadius: 10, border: `1.5px solid ${copied ? C.greenDark : C.border}`, background: copied ? C.greenLight : "none", color: copied ? C.greenDark : C.ink, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{copied ? "✓ Link copied!" : "Copy shareable link"}</button>
                </div>
            </div>
        </>
    ) : null

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div data-cbw-root="" style={{ fontFamily, background: C.cream, minHeight: "100vh", width: "100%" }}>

            {/* Goal header */}
            <div style={{ background: C.teal, padding: `28px ${padX}px 20px` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,238,227,0.78)", marginBottom: 12 }}>What&apos;s your goal?</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {GOALS.map(g => <GoalButton key={g.id} g={g} active={goal === g.id} count={goalCounts[g.id] ?? 0} total={effectiveItems.length} onClick={() => handleGoalClick(g.id)} />)}
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,238,227,0.78)" }}>Daily cal budget</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="number" data-cbw-budget="" value={budget || ""} onChange={e => setBudget(Math.max(0, Number(e.target.value)))} placeholder="e.g. 1800" aria-label="Daily calorie budget" style={{ width: 100, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${budget > 0 ? C.orange : "rgba(255,255,255,0.20)"}`, background: "rgba(255,255,255,0.10)", color: C.cream, fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                            {budgetRemaining !== null && (
                                <div style={{ fontSize: 12, color: budgetRemaining >= 0 ? C.cream : C.yellow, fontWeight: 700, lineHeight: 1.3 }} aria-live="polite" title="Your daily budget minus everything in your Compare tray">
                                    {trayState.items.length > 0
                                        ? (budgetRemaining >= 0 ? `${budgetRemaining} left` : `${Math.abs(budgetRemaining)} over`)
                                        : <span style={{ fontWeight: 500, color: "rgba(245,238,227,0.72)" }}>add items to Compare to track</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: `10px ${padX}px`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ingredient" aria-label="Search menu items" style={{ flex: 1, minWidth: 160, padding: "8px 13px", borderRadius: 8, border: `1.5px solid ${search ? C.orange : C.border}`, fontSize: 13, color: C.ink, background: C.inkGhost, outline: "none", fontFamily: "inherit", boxSizing: "border-box", opacity: isSearchPending ? 0.65 : 1, transition: "border-color 0.15s, opacity 0.1s" }} />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort order" style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.ink, background: C.white, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    <option value="goal-fit">Best Goal Fit</option>
                    <option value="protein-desc">Most Protein</option>
                    <option value="calories-asc">Fewest Calories</option>
                    <option value="calories-desc">Most Calories</option>
                </select>
                <button onClick={() => setShowMacros(p => !p)} aria-pressed={showMacros} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${showMacros ? C.teal : C.border}`, background: showMacros ? C.tealLight : "transparent", color: showMacros ? C.teal : C.inkSoft, fontFamily: "inherit" }}>{showMacros ? "Hide macros" : "Show macros"}</button>
                {activeFilters > 0 && <button onClick={() => { setSearch(""); setCategory("All"); setDietary([]) }} style={{ padding: "8px 13px", borderRadius: 8, border: `1.5px solid ${C.orangeDark}`, background: C.orangeLight, color: C.orangeDark, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}</button>}
            </div>

            {/* Dietary + category pills */}
            <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: `8px ${padX}px`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {DIETARY.map(d => { const active = dietary.includes(d); const n = dietaryCounts[d] ?? 0; const dead = !active && n === 0; return <button key={d} onClick={() => setDietary(active ? dietary.filter(x => x !== d) : [...dietary, d])} aria-pressed={active} disabled={dead} title={dead ? "No items match with your current filters" : undefined} style={{ padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: dead ? "not-allowed" : "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? C.greenDark : C.border}`, background: active ? C.greenDark : "transparent", color: active ? C.white : C.inkSoft, opacity: dead ? 0.35 : 1, transition: "all 0.12s" }}>{active ? "\u2715 " : ""}{d} ({n})</button> })}
                <div style={{ width: 1, height: 16, background: C.border, margin: "0 2px" }} aria-hidden="true" />
                {categories.map(cat => <button key={cat} onClick={() => setCategory(category === cat ? "All" : cat)} title={category === cat ? "Click again to clear" : undefined} aria-pressed={category === cat} style={{ padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${category === cat ? C.teal : C.border}`, background: category === cat ? C.teal : "transparent", color: category === cat ? C.white : C.inkSoft, transition: "all 0.12s" }}>{cat} ({categoryCounts[cat] ?? 0})</button>)}
            </div>

            {/* Fetch error banner */}
            {isError && (
                <div role="alert" style={{ padding: `10px ${padX}px`, background: C.orangeLight, borderBottom: `1px solid ${C.orange}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 12, color: C.orangeDark, fontWeight: 600 }}>Could not load menu data from endpoint.</span>
                    <button onClick={() => { setFetchState("idle"); setRetryKey(k => k + 1) }} style={{ padding: "4px 12px", borderRadius: 6, border: `1.5px solid ${C.orangeDark}`, background: "none", color: C.orangeDark, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
                </div>
            )}

            {/* Results count */}
            {!noItems && !isLoading && <div style={{ padding: `8px ${padX}px` }}><span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>{cards.length} result{cards.length === 1 ? "" : "s"}{sortBy === "goal-fit" && goal !== "all" ? " — sorted by goal fit" : ""}</span></div>}

            {/* Main layout — grid + optional in-flow detail column (desktop split view) */}
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: trayState.items.length > 0 ? 88 : 0 }}>
                <div style={{ padding: `4px ${padX}px 60px`, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, alignContent: "start" }}>

                    {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

                    {!isLoading && filtered.length === 0 && (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 0" }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: C.ink, opacity: 0.08, marginBottom: 14 }}>—</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{noItems ? "No items yet" : "Nothing matches"}</div>
                            <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>
                                {noItems && !cmsEndpoint ? "Add items via the Items panel, or paste a CMS Endpoint URL." : noItems && cmsEndpoint ? "Waiting for data from endpoint…" : "Try relaxing one of these filters:"}
                            </div>
                            {!noItems && (
                                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                    {goal !== "all"    && <button onClick={() => setGoal("all")} style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.teal}`,   background: C.tealLight,   color: C.teal,   fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Browse all goals</button>}
                                    {category !== "All"  && <button onClick={() => setCategory("All")}  style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.teal}`,   background: C.tealLight,   color: C.teal,   fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>All categories</button>}
                                    {dietary.length > 0  && <button onClick={() => setDietary([])}      style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.greenDark}`,  background: C.greenLight,  color: C.greenDark,  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear dietary</button>}
                                    {search              && <button onClick={() => setSearch("")}        style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.orangeDark}`, background: C.orangeLight, color: C.orangeDark, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear search</button>}
                                </div>
                            )}
                        </div>
                    )}

                    {!isLoading && cards.map((card, idx) => {
                        const item = card.partner && fmtSel[card.key]
                            ? ([card.item, card.partner].find(x => x.id === fmtSel[card.key]) ?? card.item)
                            : card.item
                        const alt        = card.partner
                        const isSelected = sel?.id === item.id
                        const inTray     = trayState.items.includes(item.id) || trayState.items.includes(item.title)
                        const score      = goal !== "all" ? fitScore(item, goal) : 0
                        const isTopMatch = goal !== "all" && score === maxScore && cards.length > 1
                        const trayFull   = !inTray && trayState.items.length >= MAX_TRAY
                        const cardKey    = alt ? card.key : (item.id !== String(idx) ? item.id : `${item.title}-${idx}`)
                        return (
                            <div key={cardKey} style={{ background: C.white, borderRadius: 12, overflow: "hidden", border: `2px solid ${isSelected ? C.orange : inTray ? C.teal : isTopMatch ? "rgba(123,144,21,0.35)" : "transparent"}`, boxShadow: isSelected ? `0 0 0 3px ${C.orangeLight}, 0 4px 20px rgba(0,0,0,0.09)` : "0 1px 4px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s, border-color 0.15s", position: "relative", animation: "cbwFadeUp 0.25s ease both", animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}>
                                {isTopMatch && !isSelected && <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, background: C.greenDark, color: C.white, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", padding: "3px 0" }}>Best match</div>}
                                <button
                                    onClick={e => { e.stopPropagation(); if (!trayFull) handleToggleTray(item.id) }}
                                    aria-label={inTray ? `Remove ${item.title} from compare` : trayFull ? "Compare tray full" : `Add ${item.title} to compare`}
                                    style={{ position: "absolute", top: isTopMatch && !isSelected ? 26 : 8, right: 8, zIndex: 3, width: 24, height: 24, borderRadius: "50%", background: inTray ? C.teal : trayFull ? C.inkGhost : "rgba(255,255,255,0.88)", border: `1.5px solid ${inTray ? C.teal : trayFull ? "transparent" : C.border}`, color: inTray ? C.white : C.inkSoft, fontSize: 12, fontWeight: 800, cursor: trayFull ? "not-allowed" : "pointer", opacity: trayFull ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", padding: 0 }}
                                >{inTray ? "−" : "+"}</button>
                                <div role="button" tabIndex={0} data-cbw-open={item.id} aria-expanded={isSelected} aria-label={`${item.title} — view details`}
                                    onClick={() => setSelected(isSelected ? null : item.id)}
                                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(isSelected ? null : item.id) } }}
                                    style={{ cursor: "pointer", outlineOffset: -2 }}>
                                    <div style={{ height: 140, background: C.inkGhost, overflow: "hidden", marginTop: isTopMatch && !isSelected ? 20 : 0 }}>
                                        {(item.thumbnail || alt?.thumbnail)
                                            ? <img src={scaledSrc(item.thumbnail || alt!.thumbnail, 512)} loading="lazy" alt="" role="presentation" onError={e => { const el = e.currentTarget; const fb = item.id === card.item.id ? card.partner?.thumbnail : card.item.thumbnail; if (fb && el.src !== fb) { el.src = fb } else { el.style.display = "none" } }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                            : <div aria-hidden="true" style={{ width: "100%", height: "100%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800, color: C.teal, opacity: 0.55 }}>{item.title.charAt(0)}</div>}
                                    </div>
                                    <div style={{ padding: "11px 13px 13px" }}>
                                        {alt && (() => {
                                            const wrapV = item.title.endsWith("Wrap") ? item : alt
                                            const bowlV = wrapV.id === item.id ? alt : item
                                            return (
                                                <div style={{ display: "flex", gap: 4, marginBottom: 7 }} role="group" aria-label="Format">
                                                    {[wrapV, bowlV].map(v => {
                                                        const active = v.id === item.id
                                                        const label  = v.title.endsWith("Wrap") ? "Wrap" : "Bowl"
                                                        return (
                                                            <button key={v.id} onClick={e => { e.stopPropagation(); setFmtSel(p => ({ ...p, [card.key]: v.id })) }} aria-pressed={active}
                                                                style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? C.teal : C.border}`, background: active ? C.teal : "transparent", color: active ? C.white : C.inkSoft, transition: "all 0.12s" }}>
                                                                {label}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })()}
                                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2, lineHeight: 1.3 }}><Highlight text={item.title} query={deferredSearch} /></div>
                                        {item.shortIngr && <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: showMacros ? 8 : 0, lineHeight: 1.4 }}><Highlight text={item.shortIngr} query={deferredSearch} /></div>}
                                        {showMacros && item.calories > 0 && (item.protein > 0 || item.carbs > 0) && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: C.orangeDark, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{item.protein}g</span><MacroBar value={item.protein} max={maxProtein} color={C.orange} /><span style={{ fontSize: 9, color: C.inkSoft, minWidth: 18, flexShrink: 0 }}>pro</span></div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: C.amber, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{item.carbs}g</span><MacroBar value={item.carbs} max={maxCarbs} color={C.yellow} /><span style={{ fontSize: 9, color: C.inkSoft, minWidth: 18, flexShrink: 0 }}>carb</span></div>
                                            </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            {item.calories > 0
                                                ? <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{item.calories}<span style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft }}> cal</span></span>
                                                : <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, fontStyle: "italic" }}>{isBYO(item) ? "varies by your picks" : "nutrition coming soon"}</span>}
                                            {item.price > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>${item.price.toFixed(2)}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
              </div>
              {sel && !isMobile && (
                <aside style={detailColStyle} role="region" aria-label={`${sel.title} details`}>{detailInner}</aside>
              )}
            </div>

            {/* Mobile bottom sheet — thumb-reachable, dims page, tap-scrim to close */}
            {sel && isMobile && (
                <>
                    <div onClick={handleClose} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(28,43,28,0.45)", animation: "cbwFadeUp 0.2s ease" }} />
                    <div style={sheetStyle} role="dialog" aria-modal="true" aria-label={`${sel.title} details`}>{detailInner}</div>
                </>
            )}

            {/* Nutrition disclaimer — MenuTrinfo wording matching the per-item Nutrition Panel */}
            <div style={{ padding: `0 ${padX}px 24px`, paddingBottom: trayState.items.length > 0 ? 104 : 24 }}>
                <p style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.6, maxWidth: 720, margin: 0 }}>
                    Nutrition shown for base dish without sides or modifications. Values are estimated ±10% per
                    serving. Source: Wild Eggs / MenuTrinfo LLC, April 2024.
                </p>
                <p style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.6, maxWidth: 720, margin: "6px 0 0" }}>
                    Items without values shown are pending nutrition analysis — please ask our staff about ingredients
                    and allergens.
                </p>
                <p style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.6, maxWidth: 720, margin: "6px 0 0" }}>
                    These ingredients may have come into contact with, or are produced at facilities that handle,
                    other allergens. Consuming raw or undercooked meats, poultry, seafood, shellfish, or eggs may
                    increase your risk of foodborne illness. Please notify your server of any food allergies before
                    ordering.
                </p>
            </div>

            {/* Comparison tray */}
            {trayState.items.length > 0 && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: C.ink, borderTop: `1px solid rgba(255,255,255,0.08)` }}>
                    <button onClick={() => trayDispatch({ type: "TOGGLE_OPEN" })} aria-expanded={trayState.open} style={{ width: "100%", padding: `10px ${padX}px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.cream, letterSpacing: "0.06em", textTransform: "uppercase" }}>Compare {trayState.items.length} dish{trayState.items.length > 1 ? "es" : ""}{!isMobile && <span style={{ fontWeight: 400, opacity: 0.75, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>press C</span>}</span>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "rgba(245,238,227,0.75)", textAlign: "right" }}>{trayTotals.calories} cal · {trayTotals.protein}g pro{isMobile ? "" : ` · ${trayTotals.carbs}g carbs combined`}</span>
                            <span style={{ fontSize: 14, color: "rgba(245,238,227,0.50)" }} aria-hidden="true">{trayState.open ? "▼" : "▲"}</span>
                        </div>
                    </button>
                    {trayState.open && (
                        <div style={{ padding: `0 ${padX}px 20px`, display: "flex", gap: 16, overflowX: "auto" }}>
                            {trayItems.map(item => (
                                <div key={item.id} style={{ flexShrink: 0, width: 200, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", border: `1px solid rgba(255,255,255,0.08)` }}>
                                    {item.thumbnail && <img src={item.thumbnail} alt="" role="presentation" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />}
                                    <div style={{ padding: "10px 12px" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, marginBottom: 6 }}>{item.title}</div>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>{item.protein}g pro</span>
                                            <span style={{ fontSize: 11, color: C.yellow, fontWeight: 700 }}>{item.carbs}g carb</span>
                                            <span style={{ fontSize: 11, color: "rgba(245,238,227,0.75)", fontWeight: 600 }}>{item.calories > 0 ? `${item.calories} cal` : "— cal"}</span>
                                            {item.price > 0 && <span style={{ fontSize: 11, color: C.cream, fontWeight: 600 }}>${item.price.toFixed(2)}</span>}
                                        </div>
                                        <button onClick={() => handleToggleTray(item.id)} aria-label={`Remove ${item.title} from compare`} style={{ marginTop: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid rgba(255,255,255,0.15)`, background: "none", color: "rgba(245,238,227,0.60)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ flexShrink: 0, width: 200, background: "rgba(252,97,45,0.12)", borderRadius: 10, padding: "14px 16px", border: `1px solid rgba(252,97,45,0.25)`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Combined total</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.cream, marginBottom: 2 }}>{trayTotals.calories}<span style={{ fontSize: 12, color: "rgba(245,238,227,0.75)" }}> cal</span></div>
                                <div style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{trayTotals.protein}g protein</div>
                                <div style={{ fontSize: 12, color: C.yellow, fontWeight: 600 }}>{trayTotals.carbs}g carbs</div>
                                {trayTotals.price > 0 && <div style={{ fontSize: 13, color: C.cream, fontWeight: 700, marginTop: 6 }}>${trayTotals.price.toFixed(2)} total</div>}
                                {budget > 0 && <div style={{ marginTop: 10, fontSize: 11, color: trayTotals.calories <= budget ? C.green : C.orange, fontWeight: 700 }}>{trayTotals.calories <= budget ? `${budget - trayTotals.calories} cal under budget` : `${trayTotals.calories - budget} cal over budget`}</div>}
                                <button onClick={() => trayDispatch({ type: "CLEAR" })} style={{ marginTop: 12, padding: "6px 12px", borderRadius: 8, border: `1px solid rgba(245,238,227,0.30)`, background: "none", color: "rgba(245,238,227,0.85)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>Clear all</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── 13. Export + property controls ───────────────────────────────────────────

export default WildEggsNutritionCalculator

addPropertyControls(WildEggsNutritionCalculator, {
    cmsEndpoint: {
        type: ControlType.String,
        title: "CMS Endpoint",
        defaultValue: "https://wild-eggs-nutrition-calculator.elle-f37.workers.dev/", placeholder: "https://wild-eggs-nutrition-calculator.elle-f37.workers.dev/",
        description: "Framer CMS API URL or any JSON endpoint returning menu items. Supports Framer's { type, value } field format, flat arrays, and { items: [] } wrappers.",
    },
    apiKey: {
        type: ControlType.String,
        title: "API Key",
        placeholder: "Bearer token for authenticated endpoints",
        description: "Optional. Sent as Authorization: Bearer {key}. Required for the Framer CMS API — get one from Framer → Settings → Developers.",
    },
    items: {
        type: ControlType.Array,
        title: "Items (manual)",
        control: {
            type: ControlType.Object,
            controls: {
                title:       { type: ControlType.String, title: "Title" },
                calories:    { type: ControlType.Number, title: "Calories",          defaultValue: 0 },
                protein:     { type: ControlType.Number, title: "Protein (g)",       defaultValue: 0 },
                carbs:       { type: ControlType.Number, title: "Carbs (g)",         defaultValue: 0 },
                fat:         { type: ControlType.Number, title: "Fat (g)",           defaultValue: 0 },
                category:    { type: ControlType.String, title: "Category" },
                price:       { type: ControlType.Number, title: "Price",             defaultValue: 0 },
                ingredients: { type: ControlType.String, title: "Ingredients" },
                shortIngr:   { type: ControlType.String, title: "Short Ingredients" },
                description: { type: ControlType.String, title: "Description" },
                thumbnail:   { type: ControlType.Image,  title: "Thumbnail" },
            },
        },
    },
    orderUrl:   { type: ControlType.String, title: "Order URL",   defaultValue: "#" },
    fontFamily: { type: ControlType.String, title: "Font Family", defaultValue: "Bricolage Grotesque, sans-serif" },
    stickyOffset: { type: ControlType.Number, title: "Sticky Offset", defaultValue: 96, min: 0, max: 240, unit: "px", description: "Height of the site's floating nav — keeps the detail panel (and its close button) below it." },
})

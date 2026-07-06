import { addPropertyControls, ControlType } from "framer"
import { useState, useMemo, useEffect, useRef, useDeferredValue, useReducer, useCallback, memo } from "react"

// ── 1. Constants ──────────────────────────────────────────────────────────────

const MOBILE_BP = 680
const MAX_TRAY  = 3
const LS_KEYS   = { goal: "cbw_goal", sort: "cbw_sort", item: "cbw_last_item" } as const
const SS_KEY_TRAY = "cbw_tray"

// Framer CMS field IDs for the Menu collection
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

const C = {
    orange:      "rgb(252, 97, 45)",
    orangeLight: "rgba(252, 97, 45, 0.10)",
    yellow:      "rgb(246, 192, 52)",
    green:       "rgb(123, 144, 21)",
    greenLight:  "rgba(123, 144, 21, 0.12)",
    teal:        "rgb(13, 79, 79)",
    tealLight:   "rgba(13, 79, 79, 0.08)",
    cream:       "rgb(245, 238, 227)",
    white:       "rgb(255, 255, 255)",
    ink:         "rgb(28, 43, 28)",
    inkFaint:    "rgba(28, 43, 28, 0.45)",
    inkGhost:    "rgba(28, 43, 28, 0.07)",
    border:      "rgba(28, 43, 28, 0.09)",
}

// ── 3. Styles — injected once per page load, never on re-render ───────────────

let _stylesInjected = false
function injectStyles() {
    if (_stylesInjected || typeof document === "undefined") return
    _stylesInjected = true
    const s = document.createElement("style")
    s.dataset.cbw = "1"
    s.textContent = `@keyframes cbwPulse{0%,100%{opacity:1}50%{opacity:0.45}}@keyframes cbwFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`
    document.head.appendChild(s)
}

// ── 4. Types ──────────────────────────────────────────────────────────────────

interface MenuItem {
    id:          string
    title:       string
    calories:    unknown
    protein:     unknown
    carbs:       unknown
    fat?:        unknown
    category:    string
    price:       unknown
    ingredients: string
    shortIngr:   string
    description: string
    thumbnail:   string
}

interface GoalDef {
    id:           string
    label:        string
    sub:          string
    accent:       string
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
type TrayAction = { type: "TOGGLE"; id: string } | { type: "TOGGLE_OPEN" }
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
    { id: "all",   label: "Browse All",    sub: "Full menu",     accent: C.teal },
    { id: "power", label: "Power Up",      sub: "30g+ protein",  accent: C.orange, minProtein: 30 },
    { id: "light", label: "Keep It Light", sub: "Under 500 cal", accent: C.green,  maxCalories: 500 },
    { id: "fuel",  label: "Fuel the Day",  sub: "Carb-forward",  accent: C.yellow, minCarbs: 50 },
]

const DIETARY: string[] = ["Vegetarian", "Vegan", "Gluten-Free", "High Protein", "Low Carb"]

// ── 6. Utilities ──────────────────────────────────────────────────────────────

function n(v: unknown): number { return Number(v) || 0 }

function lsGet(key: string): string | null {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null } catch { return null }
}
function lsSet(key: string, val: string): void {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(key, val) } catch { /* noop */ }
}
function lsClear(key: string): void {
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(key) } catch { /* noop */ }
}
function ssGet(key: string): string | null {
    try { return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null } catch { return null }
}
function ssSet(key: string, val: string): void {
    try { if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, val) } catch { /* noop */ }
}

function fitScore(item: MenuItem, goalId: string): number {
    if (goalId === "power") return n(item.protein)
    if (goalId === "light") return n(item.calories) > 0 ? 1000 / n(item.calories) : 0
    if (goalId === "fuel")  return n(item.carbs)
    return 0
}

// Unwraps Framer CMS { type, value } envelope — returns raw value unchanged otherwise.
function unwrapFramer(v: unknown): unknown {
    if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
        return (v as Record<string, unknown>).value
    }
    return v
}

// Maps any CMS response shape to a MenuItem.
// Priority 1: Framer CMS field IDs with { type, value } wrappers.
// Priority 2: Human-readable keys from flat JSON APIs.
function mapCmsItem(raw: Record<string, unknown>, index: number): MenuItem {
    const fd = (raw.fieldData ?? raw) as Record<string, unknown>

    const pick = (...keys: string[]): unknown => {
        for (const k of keys) {
            const v = unwrapFramer(fd[k])
            if (v !== undefined && v !== null && v !== "") return v
        }
        return undefined
    }

    return {
        id:          String(raw.id ?? raw.slug ?? index),
        title:       String(pick(FIELD.title, "title", "name", "Title", "Name") ?? ""),
        calories:    pick(FIELD.calories, "calories", "Calories", "cal"),
        protein:     pick(FIELD.protein,  "protein",  "Protein"),
        carbs:       pick(FIELD.carbs,    "carbs",    "Carbs", "carbohydrates"),
        fat:         pick("fat", "Fat"),
        category:    String(pick(FIELD.category, "category", "Category", "type", "Type") ?? ""),
        price:       pick(FIELD.price, "price", "Price"),
        ingredients: String(pick(FIELD.ingredients, "ingredients", "Ingredients") ?? ""),
        shortIngr:   String(pick(FIELD.shortIngr, "shortIngr", "shortIngredients", "short_ingredients") ?? ""),
        description: String(pick(FIELD.description, "description", "Description") ?? ""),
        thumbnail:   String(pick(FIELD.thumbnail, "thumbnail", "Thumbnail", "image", "Image", "photo") ?? ""),
    }
}

// ── 7. Reducer ────────────────────────────────────────────────────────────────

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
        default: return state
    }
}

// ── 8. Pure filter logic ──────────────────────────────────────────────────────

function applyFilters(items: MenuItem[], f: FilterState): MenuItem[] {
    let list = items
    const g = GOALS.find(g => g.id === f.goal)
    if (g) {
        if (g.minProtein  !== undefined) list = list.filter(i => n(i.protein)  >= g.minProtein!)
        if (g.maxCalories !== undefined) list = list.filter(i => n(i.calories) <= g.maxCalories!)
        if (g.minCarbs    !== undefined) list = list.filter(i => n(i.carbs)    >= g.minCarbs!)
    }
    if (f.category !== "All") list = list.filter(i => i.category === f.category)
    const q = f.search.trim().toLowerCase()
    if (q) list = list.filter(i => i.title.toLowerCase().includes(q) || i.ingredients.toLowerCase().includes(q))
    if (f.dietary.length > 0) list = list.filter(i => f.dietary.every(d => i.ingredients.toLowerCase().includes(d.toLowerCase())))
    if (f.sortBy === "calories-asc")  return [...list].sort((a, b) => n(a.calories) - n(b.calories))
    if (f.sortBy === "calories-desc") return [...list].sort((a, b) => n(b.calories) - n(a.calories))
    if (f.sortBy === "protein-desc")  return [...list].sort((a, b) => n(b.protein)  - n(a.protein))
    if (f.sortBy === "goal-fit")      return [...list].sort((a, b) => fitScore(b, f.goal) - fitScore(a, f.goal))
    return list
}

function buildGoalCounts(items: MenuItem[]): Record<string, number> {
    const counts: Record<string, number> = {}
    GOALS.forEach(g => {
        let list = items
        if (g.minProtein  !== undefined) list = list.filter(i => n(i.protein)  >= g.minProtein!)
        if (g.maxCalories !== undefined) list = list.filter(i => n(i.calories) <= g.maxCalories!)
        if (g.minCarbs    !== undefined) list = list.filter(i => n(i.carbs)    >= g.minCarbs!)
        counts[g.id] = list.length
    })
    return counts
}

function buildCategoryCounts(items: MenuItem[]): Record<string, number> {
    const counts: Record<string, number> = { All: items.length }
    items.forEach(i => { if (i.category) counts[i.category] = (counts[i.category] ?? 0) + 1 })
    return counts
}

// ── 9. Custom hooks ───────────────────────────────────────────────────────────

function useViewport(): boolean {
    const [width, setWidth] = useState<number>(() => {
        try { return typeof window !== "undefined" ? window.innerWidth : 1200 } catch { return 1200 }
    })
    useEffect(() => {
        function onResize() { try { setWidth(window.innerWidth) } catch { /* noop */ } }
        if (typeof window === "undefined") return
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])
    return width < MOBILE_BP
}

// Reads URL params once on mount via callback ref; writes back on state changes.
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
        function onKey(e: KeyboardEvent) { if (e.key === key) handlerRef.current() }
        if (typeof window === "undefined") return
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [key])
}

// ── 10. Primitive components ──────────────────────────────────────────────────

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
                <span style={{ fontSize: 10, color: C.inkFaint, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>cal</span>
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
                <div style={{ fontSize: 10, color: C.inkFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
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
            color: active ? C.white : isEmpty ? "rgba(245,238,227,0.35)" : "rgba(245,238,227,0.80)",
            cursor: isEmpty ? "default" : "pointer", textAlign: "left", transition: "all 0.15s", minWidth: 110, fontFamily: "inherit"
        }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{g.label}</div>
            <div style={{ fontSize: 10, opacity: 0.70, marginTop: 3 }}>{active ? `${count} items` : isEmpty ? "none available" : g.sub}</div>
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

// ── 11. Main component ────────────────────────────────────────────────────────

interface NutritionCalculatorProps {
    items?:       MenuItem[]
    cmsEndpoint?: string
    apiKey?:      string
    orderUrl?:    string
    fontFamily?:  string
}

function NutritionCalculator({
    items = [],
    cmsEndpoint = "",
    apiKey      = "",
    orderUrl    = "#",
    fontFamily  = "Bricolage Grotesque, sans-serif",
}: NutritionCalculatorProps) {

    // — State ——————————————————————————————————————————————————————————————————
    const [goal,       setGoal]       = useState<string>(() => lsGet(LS_KEYS.goal) ?? "all")
    const [sortBy,     setSortBy]     = useState<string>(() => lsGet(LS_KEYS.sort) ?? "goal-fit")
    const [category,   setCategory]   = useState<string>("All")
    const [dietary,    setDietary]    = useState<string[]>([])
    const [search,     setSearch]     = useState<string>("")
    const [selected,   setSelected]   = useState<string | null>(() => lsGet(LS_KEYS.item))
    const [portion,    setPortion]    = useState<number>(1)
    const [budget,     setBudget]     = useState<number>(0)
    const [showMacros, setShowMacros] = useState<boolean>(true)
    const [cmsItems,   setCmsItems]   = useState<MenuItem[]>([])
    const [fetchState, setFetchState] = useState<FetchState>("idle")
    const [retryKey,   setRetryKey]   = useState<number>(0)

    const [trayState, trayDispatch] = useReducer(trayReducer, undefined, () => {
        try { const s = ssGet(SS_KEY_TRAY); if (s) return { items: JSON.parse(s) as string[], open: false } } catch { /* noop */ }
        return { items: [] as string[], open: false }
    })

    const deferredSearch  = useDeferredValue(search)
    const isSearchPending = search !== deferredSearch
    const isMobile        = useViewport()

    const hasRealPropItems = items.some(i => i.title.trim() !== "")
    const effectiveItems   = hasRealPropItems ? items : cmsItems

    // — Stable callbacks ———————————————————————————————————————————————————————
    const handleClose      = useCallback(() => setSelected(null), [])
    const handleDeepLink   = useCallback((id: string) => setSelected(id), [])
    const handleToggleTray = useCallback((id: string) => trayDispatch({ type: "TOGGLE", id }), [])
    const handleGoalClick  = useCallback((id: string) => {
        setGoal(id)
        setSortBy(prev => id === "all" ? "default" : prev === "default" ? "goal-fit" : prev)
    }, [])

    // Hoisted so it's stable — avoids passing useCallback() directly as an argument
    const urlMountCb = useCallback(({ goal: g, category: cat, sortBy: s, item }: { goal?: string; category?: string; sortBy?: string; item?: string }) => {
        const validGoal = GOALS.find(x => x.id === g)
        if (validGoal) setGoal(validGoal.id)
        if (cat)  setCategory(cat)
        if (s)    setSortBy(s)
        if (item) handleDeepLink(item)
    }, [handleDeepLink])

    useUrlSync({ goal, category, sortBy, selected }, urlMountCb)

    // — Effects ————————————————————————————————————————————————————————————————
    useEffect(() => { injectStyles() }, [])
    useEffect(() => { lsSet(LS_KEYS.goal, goal) },    [goal])
    useEffect(() => { lsSet(LS_KEYS.sort, sortBy) },  [sortBy])
    useEffect(() => { selected ? lsSet(LS_KEYS.item, selected) : lsClear(LS_KEYS.item) }, [selected])
    useEffect(() => { setPortion(1) }, [selected])
    useEffect(() => { ssSet(SS_KEY_TRAY, JSON.stringify(trayState.items)) }, [trayState.items])

    // Clear a stale `selected` (from localStorage) when items load and the title no longer exists
    useEffect(() => {
        if (effectiveItems.length > 0 && selected && !effectiveItems.find(i => i.id === selected || i.title === selected)) {
            setSelected(null)
        }
    }, [effectiveItems]) // intentionally omits `selected` — only needs to run when items change

    // CMS fetch — retryKey in deps makes the Retry button actually re-trigger the request
    useEffect(() => {
        if (!cmsEndpoint || hasRealPropItems) return
        let cancelled = false
        setFetchState("loading")
        const headers: Record<string, string> = { Accept: "application/json" }
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
        fetch(cmsEndpoint, { headers })
            .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
            .then((data: unknown) => {
                if (cancelled) return
                const d = data as Record<string, unknown>
                const raw: Record<string, unknown>[] =
                    Array.isArray(data)    ? (data as Record<string, unknown>[]) :
                    Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) :
                    Array.isArray(d.data)  ? (d.data  as Record<string, unknown>[]) : []
                setCmsItems(raw.map((r, i) => mapCmsItem(r, i)).filter(i => i.title.trim() !== ""))
                setFetchState("success")
            })
            .catch(() => { if (!cancelled) setFetchState("error") })
        return () => { cancelled = true }
    }, [cmsEndpoint, hasRealPropItems, apiKey, retryKey])

    useKeyboard("Escape", handleClose)
    useKeyboard("c", useCallback(() => {
        const tag = typeof document !== "undefined" ? (document.activeElement?.tagName ?? "") : ""
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
        if (trayState.items.length > 0) trayDispatch({ type: "TOGGLE_OPEN" })
    }, [trayState.items.length]))

    // — Derived data ———————————————————————————————————————————————————————————
    const goalCounts     = useMemo(() => buildGoalCounts(effectiveItems),     [effectiveItems])
    const categoryCounts = useMemo(() => buildCategoryCounts(effectiveItems), [effectiveItems])
    const categories     = useMemo(() => ["All", ...Array.from(new Set(effectiveItems.map(i => i.category).filter(Boolean)))], [effectiveItems])

    // Use reduce instead of spread to avoid stack overflow on large menus
    const { maxProtein, maxCarbs } = useMemo(() => ({
        maxProtein: effectiveItems.reduce((m, i) => Math.max(m, n(i.protein)),  1),
        maxCarbs:   effectiveItems.reduce((m, i) => Math.max(m, n(i.carbs)),    1),
    }), [effectiveItems])

    const { filtered, maxScore } = useMemo(() => {
        const f  = applyFilters(effectiveItems, { goal, category, dietary, search: deferredSearch, sortBy })
        const ms = goal !== "all" && f.length > 0 ? f.reduce((m, i) => Math.max(m, fitScore(i, goal)), 1) : 1
        return { filtered: f, maxScore: ms }
    }, [effectiveItems, goal, category, dietary, deferredSearch, sortBy])

    const { trayItems, trayTotals } = useMemo(() => {
        const ti = trayState.items.map(id => effectiveItems.find(i => i.id === id || i.title === id)).filter((x): x is MenuItem => !!x)
        return { trayItems: ti, trayTotals: { calories: ti.reduce((s, i) => s + n(i.calories), 0), protein: ti.reduce((s, i) => s + n(i.protein), 0), carbs: ti.reduce((s, i) => s + n(i.carbs), 0), price: ti.reduce((s, i) => s + n(i.price), 0) } }
    }, [trayState.items, effectiveItems])

    const sel = useMemo(() => selected ? effectiveItems.find(i => i.id === selected || i.title === selected) : undefined, [selected, effectiveItems])

    const scaled = useMemo((): ScaledMacros => {
        if (!sel) return { protein: 0, carbs: 0, fat: 0, calories: 0, proteinDensity: 0 }
        const protein  = Math.round(n(sel.protein)  * portion)
        const carbs    = Math.round(n(sel.carbs)    * portion)
        const fat      = Math.round(n(sel.fat)      * portion)
        const calories = Math.round(n(sel.calories) * portion)
        return { protein, carbs, fat, calories, proteinDensity: calories > 0 ? Math.round((protein / calories) * 100) : 0 }
    }, [sel, portion])

    const swapTip = useMemo((): string | null => {
        if (!sel) return null
        if (goal === "power" && scaled.protein  < 30)  return "Add grilled chicken or tofu to push protein past 30g."
        if (goal === "light" && scaled.calories > 500) return "Skip the sauce or choose the half portion to stay under 500 cal."
        if (goal === "fuel"  && scaled.carbs    < 50)  return "Swap in brown rice or quinoa to hit your carb target."
        return null
    }, [sel, goal, scaled])

    // — Convenience ————————————————————————————————————————————————————————————
    const budgetRemaining  = budget > 0 ? budget - trayTotals.calories : null
    const activeFilters    = dietary.length + (category !== "All" ? 1 : 0) + (search ? 1 : 0)
    const noItems          = effectiveItems.length === 0
    const isLoading        = fetchState === "loading"
    const isError          = fetchState === "error"
    const panelOpen        = sel !== undefined
    // Detail panel: fixed on both mobile and desktop for predictable sticky behavior
    const detailPanelStyle = {
        position: "fixed" as const,
        top: 0, right: 0, bottom: 0,
        width: isMobile ? "100%" : 340,
        zIndex: 200,
        background: C.white,
        borderLeft: isMobile ? "none" : `1px solid ${C.border}`,
        overflowY: "auto" as const,
        display: "flex",
        flexDirection: "column" as const,
        boxShadow: isMobile ? "none" : "-4px 0 24px rgba(0,0,0,0.07)",
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ fontFamily, background: C.cream, minHeight: "100vh" }}>

            {/* Goal header */}
            <div style={{ background: C.teal, padding: "28px 32px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,238,227,0.50)", marginBottom: 12 }}>What&apos;s your goal?</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {GOALS.map(g => <GoalButton key={g.id} g={g} active={goal === g.id} count={goalCounts[g.id] ?? 0} total={effectiveItems.length} onClick={() => handleGoalClick(g.id)} />)}
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,238,227,0.50)" }}>Daily cal budget</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="number" value={budget || ""} onChange={e => setBudget(Math.max(0, Number(e.target.value)))} placeholder="e.g. 1800" aria-label="Daily calorie budget" style={{ width: 100, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${budget > 0 ? C.orange : "rgba(255,255,255,0.20)"}`, background: "rgba(255,255,255,0.10)", color: C.cream, fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                            {budgetRemaining !== null && <div style={{ fontSize: 12, color: budgetRemaining >= 0 ? C.cream : C.orange, fontWeight: 700 }} aria-live="polite">{budgetRemaining >= 0 ? `${budgetRemaining} left` : `${Math.abs(budgetRemaining)} over`}</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "10px 32px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ingredient" aria-label="Search menu items" style={{ flex: 1, minWidth: 160, padding: "8px 13px", borderRadius: 8, border: `1.5px solid ${search ? C.orange : C.border}`, fontSize: 13, color: C.ink, background: C.inkGhost, outline: "none", fontFamily: "inherit", boxSizing: "border-box", opacity: isSearchPending ? 0.65 : 1, transition: "border-color 0.15s, opacity 0.1s" }} />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort order" style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.ink, background: C.white, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    <option value="default">Sort: Default</option>
                    <option value="goal-fit">Best Goal Fit</option>
                    <option value="protein-desc">Most Protein</option>
                    <option value="calories-asc">Fewest Calories</option>
                    <option value="calories-desc">Most Calories</option>
                </select>
                <button onClick={() => setShowMacros(p => !p)} aria-pressed={showMacros} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${showMacros ? C.teal : C.border}`, background: showMacros ? C.tealLight : "transparent", color: showMacros ? C.teal : C.inkFaint, fontFamily: "inherit" }}>{showMacros ? "Hide macros" : "Show macros"}</button>
                {activeFilters > 0 && <button onClick={() => { setSearch(""); setCategory("All"); setDietary([]) }} style={{ padding: "8px 13px", borderRadius: 8, border: `1.5px solid ${C.orange}`, background: C.orangeLight, color: C.orange, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}</button>}
            </div>

            {/* Dietary + category pills */}
            <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "8px 32px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {DIETARY.map(d => { const active = dietary.includes(d); return <button key={d} onClick={() => setDietary(active ? dietary.filter(x => x !== d) : [...dietary, d])} aria-pressed={active} style={{ padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? C.green : C.border}`, background: active ? C.green : "transparent", color: active ? C.white : C.inkFaint, transition: "all 0.12s" }}>{d}</button> })}
                <div style={{ width: 1, height: 16, background: C.border, margin: "0 2px" }} aria-hidden="true" />
                {categories.map(cat => <button key={cat} onClick={() => setCategory(cat)} aria-pressed={category === cat} style={{ padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${category === cat ? C.teal : C.border}`, background: category === cat ? C.teal : "transparent", color: category === cat ? C.white : C.inkFaint, transition: "all 0.12s" }}>{cat} ({categoryCounts[cat] ?? 0})</button>)}
            </div>

            {/* Fetch error banner */}
            {isError && (
                <div role="alert" style={{ padding: "10px 32px", background: C.orangeLight, borderBottom: `1px solid ${C.orange}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 12, color: C.orange, fontWeight: 600 }}>Could not load menu data from endpoint.</span>
                    <button onClick={() => { setFetchState("idle"); setRetryKey(k => k + 1) }} style={{ padding: "4px 12px", borderRadius: 6, border: `1.5px solid ${C.orange}`, background: "none", color: C.orange, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
                </div>
            )}

            {/* Results count */}
            {!noItems && !isLoading && <div style={{ padding: "8px 32px" }}><span style={{ fontSize: 11, color: C.inkFaint, fontWeight: 500 }}>{filtered.length} of {effectiveItems.length} items{sortBy === "goal-fit" && goal !== "all" ? " — sorted by goal fit" : ""}</span></div>}

            {/* Main layout — card grid shifts left when detail panel is open */}
            <div style={{ paddingRight: panelOpen && !isMobile ? 340 : 0, paddingBottom: trayState.items.length > 0 ? 88 : 0, transition: "padding-right 0.2s ease" }}>
                <div style={{ padding: "4px 32px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, alignContent: "start" }}>

                    {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

                    {!isLoading && filtered.length === 0 && (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 0" }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: C.ink, opacity: 0.08, marginBottom: 14 }}>—</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{noItems ? "No items yet" : "Nothing matches"}</div>
                            <div style={{ fontSize: 13, color: C.inkFaint, marginBottom: 16 }}>
                                {noItems && !cmsEndpoint ? "Add items via the Items panel, or paste a CMS Endpoint URL." : noItems && cmsEndpoint ? "Waiting for data from endpoint…" : "Try relaxing one of these filters:"}
                            </div>
                            {!noItems && (
                                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                    {goal !== "all"    && <button onClick={() => { setGoal("all"); setSortBy("default") }} style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.teal}`,   background: C.tealLight,   color: C.teal,   fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Browse all goals</button>}
                                    {category !== "All"  && <button onClick={() => setCategory("All")}  style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.teal}`,   background: C.tealLight,   color: C.teal,   fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>All categories</button>}
                                    {dietary.length > 0  && <button onClick={() => setDietary([])}      style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.green}`,  background: C.greenLight,  color: C.green,  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear dietary</button>}
                                    {search              && <button onClick={() => setSearch("")}        style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.orange}`, background: C.orangeLight, color: C.orange, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear search</button>}
                                </div>
                            )}
                        </div>
                    )}

                    {!isLoading && filtered.map((item, idx) => {
                        const isSelected = sel?.id === item.id
                        const inTray     = trayState.items.includes(item.id) || trayState.items.includes(item.title)
                        const score      = goal !== "all" ? fitScore(item, goal) : 0
                        const isTopMatch = goal !== "all" && score === maxScore && filtered.length > 1
                        const cal = n(item.calories), prot = n(item.protein), carb = n(item.carbs)
                        const trayFull = !inTray && trayState.items.length >= MAX_TRAY
                        // Stable key: CMS id if available, else title+idx to avoid collisions on duplicate titles
                        const cardKey = item.id !== String(idx) ? item.id : `${item.title}-${idx}`
                        return (
                            <div key={cardKey} style={{ background: C.white, borderRadius: 12, overflow: "hidden", border: `2px solid ${isSelected ? C.orange : inTray ? C.teal : isTopMatch ? "rgba(123,144,21,0.35)" : "transparent"}`, boxShadow: isSelected ? `0 0 0 3px ${C.orangeLight}, 0 4px 20px rgba(0,0,0,0.09)` : "0 1px 4px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s, border-color 0.15s", position: "relative", animation: "cbwFadeUp 0.25s ease both", animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}>
                                {isTopMatch && !isSelected && <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, background: C.green, color: C.white, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", padding: "3px 0" }}>Best match</div>}
                                <button
                                    onClick={e => { e.stopPropagation(); if (!trayFull) handleToggleTray(item.id) }}
                                    aria-label={inTray ? `Remove ${item.title} from compare` : trayFull ? "Compare tray full" : `Add ${item.title} to compare`}
                                    style={{ position: "absolute", top: isTopMatch && !isSelected ? 26 : 8, right: 8, zIndex: 3, width: 24, height: 24, borderRadius: "50%", background: inTray ? C.teal : trayFull ? C.inkGhost : "rgba(255,255,255,0.88)", border: `1.5px solid ${inTray ? C.teal : trayFull ? "transparent" : C.border}`, color: inTray ? C.white : C.inkFaint, fontSize: 12, fontWeight: 800, cursor: trayFull ? "not-allowed" : "pointer", opacity: trayFull ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", padding: 0 }}
                                >{inTray ? "−" : "+"}</button>
                                <div onClick={() => setSelected(isSelected ? null : item.id)} style={{ cursor: "pointer" }}>
                                    <div style={{ height: 140, background: C.inkGhost, overflow: "hidden", marginTop: isTopMatch && !isSelected ? 20 : 0 }}>
                                        {item.thumbnail ? <img src={item.thumbnail} alt="" role="presentation" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.tealLight}, ${C.inkGhost})` }} />}
                                    </div>
                                    <div style={{ padding: "11px 13px 13px" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2, lineHeight: 1.3 }}><Highlight text={item.title} query={deferredSearch} /></div>
                                        {item.shortIngr && <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: showMacros ? 8 : 0, lineHeight: 1.4 }}><Highlight text={item.shortIngr} query={deferredSearch} /></div>}
                                        {showMacros && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: C.orange, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{prot}g</span><MacroBar value={prot} max={maxProtein} color={C.orange} /><span style={{ fontSize: 9, color: C.inkFaint, minWidth: 18, flexShrink: 0 }}>pro</span></div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: C.yellow, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{carb}g</span><MacroBar value={carb} max={maxCarbs} color={C.yellow} /><span style={{ fontSize: 9, color: C.inkFaint, minWidth: 18, flexShrink: 0 }}>carb</span></div>
                                            </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{cal}<span style={{ fontSize: 10, fontWeight: 600, color: C.inkFaint }}> cal</span></span>
                                            {n(item.price) > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>${n(item.price).toFixed(2)}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Detail panel — fixed, slides in from the right */}
            {panelOpen && (
                <div style={detailPanelStyle} role="dialog" aria-label={`${sel!.title} details`}>
                    <div style={{ height: 200, background: C.inkGhost, position: "relative", flexShrink: 0 }}>
                        {sel!.thumbnail ? <img src={sel!.thumbnail} alt={sel!.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.teal}, ${C.green})` }} />}
                        <button onClick={handleClose} aria-label="Close detail panel" style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none", cursor: "pointer", fontSize: 16, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
                        {scaled.proteinDensity > 0 && <div style={{ position: "absolute", bottom: 12, left: 12, background: scaled.proteinDensity >= 8 ? C.green : C.teal, color: C.white, fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 8, letterSpacing: "0.06em" }}>{scaled.proteinDensity}g protein / 100 cal</div>}
                    </div>
                    <div style={{ padding: "18px 20px 36px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                        <div>
                            <h3 style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: "0 0 3px", lineHeight: 1.2 }}>{sel!.title}</h3>
                            {sel!.category && <div style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.12em" }}>{sel!.category}</div>}
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 6 }}>Portion size</div>
                            <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Portion size">
                                {PORTION_LABELS.map(p => <button key={p.val} onClick={() => setPortion(p.val)} aria-pressed={portion === p.val} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", border: `1.5px solid ${portion === p.val ? C.orange : C.border}`, background: portion === p.val ? C.orangeLight : "transparent", color: portion === p.val ? C.orange : C.inkFaint }}>{p.label}</button>)}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px", background: C.inkGhost, borderRadius: 12 }}>
                            <MacroRing protein={scaled.protein} carbs={scaled.carbs} fat={scaled.fat} calories={scaled.calories} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <MacroStat label="Protein" value={scaled.protein} unit="g" color={C.orange} />
                                <MacroStat label="Carbs"   value={scaled.carbs}   unit="g" color={C.yellow} />
                                {scaled.fat > 0 && <MacroStat label="Fat" value={scaled.fat} unit="g" color={C.green} />}
                            </div>
                        </div>
                        {budget > 0 && scaled.calories > 0 && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderRadius: 10, background: C.tealLight, border: `1px solid ${C.teal}` }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>This bowl</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{scaled.calories} cal</span>
                                <span style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>{Math.round((scaled.calories / budget) * 100)}% of daily goal</span>
                            </div>
                        )}
                        {goal !== "all" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, background: swapTip ? C.orangeLight : C.greenLight, borderLeft: `3px solid ${swapTip ? C.orange : C.green}` }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: swapTip ? C.orange : C.green, textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 58 }}>{swapTip ? "Tweak it" : "Great fit"}</div>
                                <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{swapTip ?? "This item aligns well with your " + (GOALS.find(g => g.id === goal)?.label ?? "") + " goal."}</div>
                            </div>
                        )}
                        {sel!.description && <p style={{ fontSize: 13, color: C.inkFaint, margin: 0, lineHeight: 1.7 }}>{sel!.description}</p>}
                        {sel!.ingredients && (
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 5 }}>Ingredients</div>
                                <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.75, opacity: 0.75 }}>{sel!.ingredients}</div>
                            </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                            <a href={orderUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "14px", borderRadius: 10, background: C.orange, color: C.white, fontWeight: 700, fontSize: 14, textDecoration: "none", fontFamily: "inherit", letterSpacing: "0.01em" }}>{n(sel!.price) > 0 ? `Order Now — $${n(sel!.price).toFixed(2)}` : "Order Now"}</a>
                            <button onClick={() => { try { if (typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.set("item", sel!.id); navigator.clipboard?.writeText(url.toString()) } } catch { /* noop */ } }} style={{ padding: "11px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "none", color: C.ink, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Copy shareable link</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comparison tray */}
            {trayState.items.length > 0 && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: C.ink, borderTop: `1px solid rgba(255,255,255,0.08)` }}>
                    <button onClick={() => trayDispatch({ type: "TOGGLE_OPEN" })} aria-expanded={trayState.open} style={{ width: "100%", padding: "10px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.cream, letterSpacing: "0.06em", textTransform: "uppercase" }}>Compare {trayState.items.length} bowl{trayState.items.length > 1 ? "s" : ""}<span style={{ fontWeight: 400, opacity: 0.45, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>press C</span></span>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: C.inkFaint }}>{trayTotals.calories} cal · {trayTotals.protein}g protein · {trayTotals.carbs}g carbs combined</span>
                            <span style={{ fontSize: 14, color: "rgba(245,238,227,0.50)" }} aria-hidden="true">{trayState.open ? "▼" : "▲"}</span>
                        </div>
                    </button>
                    {trayState.open && (
                        <div style={{ padding: "0 32px 20px", display: "flex", gap: 16, overflowX: "auto" }}>
                            {trayItems.map(item => (
                                <div key={item.id} style={{ flexShrink: 0, width: 200, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", border: `1px solid rgba(255,255,255,0.08)` }}>
                                    {item.thumbnail && <img src={item.thumbnail} alt="" role="presentation" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />}
                                    <div style={{ padding: "10px 12px" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, marginBottom: 6 }}>{item.title}</div>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>{n(item.protein)}g pro</span>
                                            <span style={{ fontSize: 11, color: C.yellow, fontWeight: 700 }}>{n(item.carbs)}g carb</span>
                                            <span style={{ fontSize: 11, color: C.inkFaint, fontWeight: 600 }}>{n(item.calories)} cal</span>
                                            {n(item.price) > 0 && <span style={{ fontSize: 11, color: C.cream, fontWeight: 600 }}>${n(item.price).toFixed(2)}</span>}
                                        </div>
                                        <button onClick={() => handleToggleTray(item.id)} aria-label={`Remove ${item.title} from compare`} style={{ marginTop: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid rgba(255,255,255,0.15)`, background: "none", color: "rgba(245,238,227,0.60)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ flexShrink: 0, width: 200, background: "rgba(252,97,45,0.12)", borderRadius: 10, padding: "14px 16px", border: `1px solid rgba(252,97,45,0.25)`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Combined total</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.cream, marginBottom: 2 }}>{trayTotals.calories}<span style={{ fontSize: 12, color: C.inkFaint }}> cal</span></div>
                                <div style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{trayTotals.protein}g protein</div>
                                <div style={{ fontSize: 12, color: C.yellow, fontWeight: 600 }}>{trayTotals.carbs}g carbs</div>
                                {trayTotals.price > 0 && <div style={{ fontSize: 13, color: C.cream, fontWeight: 700, marginTop: 6 }}>${trayTotals.price.toFixed(2)} total</div>}
                                {budget > 0 && <div style={{ marginTop: 10, fontSize: 11, color: trayTotals.calories <= budget ? C.green : C.orange, fontWeight: 700 }}>{trayTotals.calories <= budget ? `${budget - trayTotals.calories} cal under budget` : `${trayTotals.calories - budget} cal over budget`}</div>}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── 12. Export + property controls ───────────────────────────────────────────

export default NutritionCalculator

addPropertyControls(NutritionCalculator, {
    cmsEndpoint: {
        type: ControlType.String,
        title: "CMS Endpoint",
        placeholder: "https://api.framer.com/store/api/v1/collections/fEfKTjIH1/items",
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
})

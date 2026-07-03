import { addPropertyControls, ControlType } from "framer"
import { useState, useMemo, useEffect } from "react"

const C = {
    orange:      "rgb(252, 97, 45)",
    orangeLight: "rgba(252, 97, 45, 0.10)",
    orangeDark:  "rgb(210, 75, 28)",
    yellow:      "rgb(246, 192, 52)",
    yellowLight: "rgba(246, 192, 52, 0.12)",
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

// CMS stores numeric fields as strings — coerce safely
function n(v: any): number { return Number(v) || 0 }

interface MenuItem {
    title:       string
    calories:    any   // CMS sends as string; use n() to coerce
    protein:     any
    carbs:       any
    fat?:        any
    category:    string
    price:       any   // CMS number field
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

const GOALS: GoalDef[] = [
    { id: "all",   label: "Browse All",    sub: "Full menu",     accent: C.teal },
    { id: "power", label: "Power Up",      sub: "30g+ protein",  accent: C.orange, minProtein: 30 },
    { id: "light", label: "Keep It Light", sub: "Under 500 cal", accent: C.green,  maxCalories: 500 },
    { id: "fuel",  label: "Fuel the Day",  sub: "Carb-forward",  accent: C.yellow, minCarbs: 50 },
]

const DIETARY: string[] = ["Vegetarian", "Vegan", "Gluten-Free", "High Protein", "Low Carb"]

function fitScore(item: MenuItem, goalId: string): number {
    if (goalId === "power") return n(item.protein)
    if (goalId === "light") return n(item.calories) > 0 ? 1000 / n(item.calories) : 0
    if (goalId === "fuel")  return n(item.carbs)
    return 0
}

function lsGet(key: string): string | null {
    try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null } catch { return null }
}
function lsSet(key: string, val: string): void {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(key, val) } catch { /* noop */ }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroBar(props: { value: number; max: number; color: string }) {
    const pct = props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0
    return (
        <div style={{ height: 3, background: C.inkGhost, borderRadius: 2, overflow: "hidden", flex: 1 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: props.color, borderRadius: 2, transition: "width 0.3s ease" }} />
        </div>
    )
}

interface MacroRingProps { protein: number; carbs: number; fat: number; calories: number; size?: number }
function MacroRing(props: MacroRingProps) {
    const { protein, carbs, fat, calories, size = 140 } = props
    const total  = protein * 4 + carbs * 4 + fat * 9
    const r = 40, sw = 9, circ = 2 * Math.PI * r
    const proLen = total > 0 ? (protein * 4 / total) * circ : 0
    const carLen = total > 0 ? (carbs   * 4 / total) * circ : 0
    const fatLen = total > 0 ? (fat     * 9 / total) * circ : 0
    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", display: "block" }}>
                <circle cx="50" cy="50" r={r} fill="none" stroke={C.inkGhost} strokeWidth={sw} />
                {proLen > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke={C.orange} strokeWidth={sw}
                    strokeDasharray={`${proLen} ${circ}`} strokeDashoffset={0} strokeLinecap="round" />}
                {carLen > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke={C.yellow} strokeWidth={sw}
                    strokeDasharray={`${carLen} ${circ}`} strokeDashoffset={-proLen} strokeLinecap="round" />}
                {fatLen > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke={C.green} strokeWidth={sw}
                    strokeDasharray={`${fatLen} ${circ}`} strokeDashoffset={-(proLen + carLen)} strokeLinecap="round" />}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{calories}</span>
                <span style={{ fontSize: 10, color: C.inkFaint, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>cal</span>
            </div>
        </div>
    )
}

function MacroStat(props: { label: string; value: number; unit: string; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: props.color, flexShrink: 0 }} />
            <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                    {props.value}<span style={{ fontSize: 12, fontWeight: 600 }}>{props.unit}</span>
                </div>
                <div style={{ fontSize: 10, color: C.inkFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{props.label}</div>
            </div>
        </div>
    )
}

function GoalButton(props: { g: GoalDef; active: boolean; count: number; onClick: () => void }) {
    const { g, active, count, onClick } = props
    return (
        <button onClick={onClick} style={{
            padding: "11px 18px", borderRadius: 10,
            border: `1.5px solid ${active ? g.accent : "rgba(255,255,255,0.15)"}`,
            background: active ? g.accent : "rgba(255,255,255,0.06)",
            color: active ? C.white : "rgba(245,238,227,0.80)",
            cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            minWidth: 110, fontFamily: "inherit"
        }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{g.label}</div>
            <div style={{ fontSize: 10, opacity: 0.70, marginTop: 3 }}>
                {active ? `${count} items` : g.sub}
            </div>
        </button>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

interface NutritionCalculatorProps {
    items?:      MenuItem[]
    orderUrl?:   string
    fontFamily?: string
}

function NutritionCalculator(props: NutritionCalculatorProps) {
    const { items = [], orderUrl = "#", fontFamily = "Bricolage Grotesque, sans-serif" } = props

    const [goal,       setGoal]       = useState<string>(() => lsGet("cbw_goal") ?? "all")
    const [category,   setCategory]   = useState<string>("All")
    const [dietary,    setDietary]    = useState<string[]>([])
    const [search,     setSearch]     = useState<string>("")
    const [selected,   setSelected]   = useState<string | null>(() => lsGet("cbw_last_item"))
    const [sortBy,     setSortBy]     = useState<string>("goal-fit")
    const [portion,    setPortion]    = useState<number>(1)
    const [tray,       setTray]       = useState<string[]>([])
    const [trayOpen,   setTrayOpen]   = useState<boolean>(false)
    const [budget,     setBudget]     = useState<number>(0)
    const [showMacros, setShowMacros] = useState<boolean>(true)

    // Persist goal + last-viewed item
    useEffect(() => { lsSet("cbw_goal", goal) }, [goal])
    useEffect(() => { if (selected) lsSet("cbw_last_item", selected) }, [selected])

    const maxProtein = useMemo(() => Math.max(...items.map(i => n(i.protein)), 1), [items])

    const categories = useMemo((): string[] =>
        ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))],
        [items]
    )

    const goalCounts = useMemo(() => {
        const counts: { [k: string]: number } = {}
        GOALS.forEach(g => {
            let list = [...items]
            if (g.minProtein  !== undefined) list = list.filter(i => n(i.protein)  >= (g.minProtein  as number))
            if (g.maxCalories !== undefined) list = list.filter(i => n(i.calories) <= (g.maxCalories as number))
            if (g.minCarbs    !== undefined) list = list.filter(i => n(i.carbs)    >= (g.minCarbs    as number))
            counts[g.id] = list.length
        })
        return counts
    }, [items])

    const filtered = useMemo((): MenuItem[] => {
        let list: MenuItem[] = [...items]
        const g: GoalDef | undefined = GOALS.find(g => g.id === goal)
        if (g !== undefined) {
            if (g.minProtein  !== undefined) list = list.filter(i => n(i.protein)  >= (g.minProtein  as number))
            if (g.maxCalories !== undefined) list = list.filter(i => n(i.calories) <= (g.maxCalories as number))
            if (g.minCarbs    !== undefined) list = list.filter(i => n(i.carbs)    >= (g.minCarbs    as number))
        }
        if (category !== "All") list = list.filter(i => i.category === category)
        const q = search.trim().toLowerCase()
        if (q) list = list.filter(i =>
            (i.title || "").toLowerCase().includes(q) ||
            (i.ingredients || "").toLowerCase().includes(q)
        )
        if (dietary.length > 0) list = list.filter(i =>
            dietary.every((d: string) => (i.ingredients || "").toLowerCase().includes(d.toLowerCase()))
        )
        if (sortBy === "calories-asc")  list = [...list].sort((a, b) => n(a.calories) - n(b.calories))
        if (sortBy === "calories-desc") list = [...list].sort((a, b) => n(b.calories) - n(a.calories))
        if (sortBy === "protein-desc")  list = [...list].sort((a, b) => n(b.protein)  - n(a.protein))
        if (sortBy === "goal-fit")      list = [...list].sort((a, b) => fitScore(b, goal) - fitScore(a, goal))
        return list
    }, [items, goal, category, dietary, search, sortBy])

    const sel: MenuItem | undefined = useMemo(
        () => selected !== null ? items.find(i => i.title === selected) : undefined,
        [selected, items]
    )

    // Scaled macros for portion toggle
    const scaledProtein  = sel ? Math.round(n(sel.protein)  * portion) : 0
    const scaledCarbs    = sel ? Math.round(n(sel.carbs)    * portion) : 0
    const scaledFat      = sel ? Math.round(n(sel.fat)      * portion) : 0
    const scaledCalories = sel ? Math.round(n(sel.calories) * portion) : 0
    const proteinDensity = scaledCalories > 0 ? Math.round((scaledProtein / scaledCalories) * 100) : 0

    const swapTip: string | null = useMemo(() => {
        if (!sel) return null
        if (goal === "power" && n(sel.protein)  < 30)  return "Add grilled chicken or tofu to push protein past 30g."
        if (goal === "light" && n(sel.calories) > 500)  return "Skip the sauce or choose the half portion to stay under 500 cal."
        if (goal === "fuel"  && n(sel.carbs)    < 50)  return "Swap in brown rice or quinoa to hit your carb target."
        return null
    }, [sel, goal])

    const activeFilters = dietary.length + (category !== "All" ? 1 : 0) + (search ? 1 : 0)
    const noItems = items.length === 0

    // Tray item objects
    const trayItems = useMemo(() => tray.map(t => items.find(i => i.title === t)).filter((x): x is MenuItem => !!x), [tray, items])
    const trayTotals = useMemo(() => ({
        calories: trayItems.reduce((s, i) => s + n(i.calories), 0),
        protein:  trayItems.reduce((s, i) => s + n(i.protein),  0),
        carbs:    trayItems.reduce((s, i) => s + n(i.carbs),    0),
    }), [trayItems])

    const budgetRemaining = budget > 0 ? budget - trayTotals.calories : null

    function toggleTray(title: string) {
        setTray(prev =>
            prev.includes(title)
                ? prev.filter(t => t !== title)
                : prev.length < 3 ? [...prev, title] : prev
        )
    }

    const portionLabels: { val: number; label: string }[] = [
        { val: 0.5, label: "Half" },
        { val: 1,   label: "Regular" },
        { val: 1.5, label: "Large" },
    ]

    return (
        <div style={{ fontFamily, background: C.cream, minHeight: "100vh" }}>

            {/* ── Goal header ──────────────────────────────────────────── */}
            <div style={{ background: C.teal, padding: "28px 32px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,238,227,0.50)", marginBottom: 12 }}>
                            What&apos;s your goal?
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {GOALS.map((g: GoalDef) => (
                                <GoalButton key={g.id} g={g} active={goal === g.id} count={goalCounts[g.id] ?? 0}
                                    onClick={() => { setGoal(g.id); setSortBy("goal-fit") }} />
                            ))}
                        </div>
                    </div>
                    {/* Calorie budget input */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,238,227,0.50)" }}>
                            Daily cal budget
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="number"
                                value={budget || ""}
                                onChange={e => setBudget(Number(e.target.value))}
                                placeholder="e.g. 1800"
                                style={{
                                    width: 100, padding: "7px 10px", borderRadius: 8,
                                    border: `1.5px solid ${budget > 0 ? C.orange : "rgba(255,255,255,0.20)"}`,
                                    background: "rgba(255,255,255,0.10)", color: C.cream,
                                    fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none"
                                }}
                            />
                            {budgetRemaining !== null && (
                                <div style={{ fontSize: 12, color: budgetRemaining >= 0 ? C.cream : C.orange, fontWeight: 700 }}>
                                    {budgetRemaining >= 0 ? `${budgetRemaining} left` : `${Math.abs(budgetRemaining)} over`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "10px 32px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or ingredient"
                    style={{
                        flex: 1, minWidth: 160, padding: "8px 13px", borderRadius: 8,
                        border: `1.5px solid ${search ? C.orange : C.border}`,
                        fontSize: 13, color: C.ink, background: C.inkGhost,
                        outline: "none", fontFamily: "inherit", boxSizing: "border-box" as any,
                        transition: "border-color 0.15s"
                    }}
                />
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    style={{
                        padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`,
                        fontSize: 12, fontWeight: 600, color: C.ink, background: C.white,
                        cursor: "pointer", fontFamily: "inherit", outline: "none"
                    }}
                >
                    <option value="default">Sort: Default</option>
                    <option value="goal-fit">Best Goal Fit</option>
                    <option value="protein-desc">Most Protein</option>
                    <option value="calories-asc">Fewest Calories</option>
                    <option value="calories-desc">Most Calories</option>
                </select>
                <button onClick={() => setShowMacros(p => !p)} style={{
                    padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1.5px solid ${showMacros ? C.teal : C.border}`,
                    background: showMacros ? C.tealLight : "transparent",
                    color: showMacros ? C.teal : C.inkFaint, fontFamily: "inherit"
                }}>
                    {showMacros ? "Hide macros" : "Show macros"}
                </button>
                {activeFilters > 0 && (
                    <button onClick={() => { setSearch(""); setCategory("All"); setDietary([]) }} style={{
                        padding: "8px 13px", borderRadius: 8, border: `1.5px solid ${C.orange}`,
                        background: C.orangeLight, color: C.orange, fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
                    }}>
                        Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
                    </button>
                )}
            </div>

            {/* ── Dietary + category ───────────────────────────────────── */}
            <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "8px 32px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {DIETARY.map((d: string) => {
                    const active = dietary.includes(d)
                    return (
                        <button key={d} onClick={() => setDietary(active ? dietary.filter((x: string) => x !== d) : [...dietary, d])} style={{
                            padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                            border: `1.5px solid ${active ? C.green : C.border}`,
                            background: active ? C.green : "transparent",
                            color: active ? C.white : C.inkFaint,
                            transition: "all 0.12s"
                        }}>
                            {d}
                        </button>
                    )
                })}
                <div style={{ width: 1, height: 16, background: C.border, margin: "0 2px" }} />
                {categories.map((cat: string) => (
                    <button key={cat} onClick={() => setCategory(cat)} style={{
                        padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                        border: `1.5px solid ${category === cat ? C.teal : C.border}`,
                        background: category === cat ? C.teal : "transparent",
                        color: category === cat ? C.white : C.inkFaint,
                        transition: "all 0.12s"
                    }}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* ── Results bar ──────────────────────────────────────────── */}
            {!noItems && (
                <div style={{ padding: "8px 32px" }}>
                    <span style={{ fontSize: 11, color: C.inkFaint, fontWeight: 500 }}>
                        {filtered.length} of {items.length} items
                        {sortBy === "goal-fit" && goal !== "all" ? " — sorted by goal fit" : ""}
                    </span>
                </div>
            )}

            {/* ── Main layout ───────────────────────────────────────────── */}
            <div style={{ display: "flex", paddingBottom: tray.length > 0 ? 88 : 0 }}>

                {/* Card grid */}
                <div style={{ flex: 1, padding: "4px 32px 60px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, alignContent: "start" }}>

                    {filtered.length === 0 && (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 0" }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: C.ink, opacity: 0.08, marginBottom: 14 }}>—</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
                                {noItems ? "No items yet" : "Nothing matches"}
                            </div>
                            <div style={{ fontSize: 13, color: C.inkFaint }}>
                                {noItems ? "Menu items will appear here once connected." : "Try a different goal or clear your filters."}
                            </div>
                        </div>
                    )}

                    {filtered.map((item: MenuItem) => {
                        const isSelected  = sel !== undefined && sel.title === item.title
                        const inTray      = tray.includes(item.title)
                        const score       = goal !== "all" ? fitScore(item, goal) : 0
                        const maxScore    = goal !== "all" ? Math.max(...filtered.map(i => fitScore(i, goal)), 1) : 1
                        const isTopMatch  = goal !== "all" && score === maxScore && filtered.length > 1
                        const cal         = n(item.calories)
                        const prot        = n(item.protein)
                        const carb        = n(item.carbs)
                        return (
                            <div key={item.title} style={{
                                background: C.white, borderRadius: 12, overflow: "hidden",
                                border: `2px solid ${isSelected ? C.orange : inTray ? C.teal : isTopMatch ? "rgba(123,144,21,0.35)" : "transparent"}`,
                                boxShadow: isSelected ? `0 0 0 3px ${C.orangeLight}, 0 4px 20px rgba(0,0,0,0.09)` : "0 1px 4px rgba(0,0,0,0.06)",
                                transition: "box-shadow 0.15s, border-color 0.15s",
                                position: "relative"
                            }}>
                                {isTopMatch && !isSelected && (
                                    <div style={{
                                        position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
                                        background: C.green, color: C.white,
                                        fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                                        textTransform: "uppercase", textAlign: "center", padding: "3px 0"
                                    }}>
                                        Best match
                                    </div>
                                )}
                                {/* Compare toggle */}
                                <button
                                    onClick={e => { e.stopPropagation(); toggleTray(item.title) }}
                                    title={inTray ? "Remove from compare" : tray.length >= 3 ? "Compare up to 3 items" : "Add to compare"}
                                    style={{
                                        position: "absolute", top: isTopMatch && !isSelected ? 26 : 8, right: 8, zIndex: 3,
                                        width: 24, height: 24, borderRadius: "50%",
                                        background: inTray ? C.teal : "rgba(255,255,255,0.88)",
                                        border: `1.5px solid ${inTray ? C.teal : C.border}`,
                                        color: inTray ? C.white : C.inkFaint,
                                        fontSize: 12, fontWeight: 800, cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontFamily: "inherit", padding: 0
                                    }}
                                >
                                    {inTray ? "−" : "+"}
                                </button>
                                <div
                                    onClick={() => setSelected(isSelected ? null : item.title)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div style={{ height: 140, background: C.inkGhost, overflow: "hidden", marginTop: isTopMatch && !isSelected ? 20 : 0 }}>
                                        {item.thumbnail
                                            ? <img src={item.thumbnail} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                            : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.tealLight}, ${C.inkGhost})` }} />
                                        }
                                    </div>
                                    <div style={{ padding: "11px 13px 13px" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2, lineHeight: 1.3 }}>{item.title}</div>
                                        {item.shortIngr && <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: showMacros ? 8 : 0, lineHeight: 1.4 }}>{item.shortIngr}</div>}

                                        {showMacros && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                    <span style={{ fontSize: 10, color: C.orange, fontWeight: 700, width: 30 }}>{prot}g</span>
                                                    <MacroBar value={prot} max={maxProtein} color={C.orange} />
                                                    <span style={{ fontSize: 9, color: C.inkFaint, width: 18 }}>pro</span>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                    <span style={{ fontSize: 10, color: C.yellow, fontWeight: 700, width: 30 }}>{carb}g</span>
                                                    <MacroBar value={carb} max={60} color={C.yellow} />
                                                    <span style={{ fontSize: 9, color: C.inkFaint, width: 18 }}>carb</span>
                                                </div>
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

                {/* Detail panel */}
                {sel !== undefined && (
                    <div style={{
                        width: 340, flexShrink: 0, background: C.white,
                        borderLeft: `1px solid ${C.border}`,
                        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
                        display: "flex", flexDirection: "column"
                    }}>
                        <div style={{ height: 200, background: C.inkGhost, position: "relative", flexShrink: 0 }}>
                            {sel.thumbnail
                                ? <img src={sel.thumbnail} alt={sel.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.teal}, ${C.green})` }} />
                            }
                            <button onClick={() => setSelected(null)} style={{
                                position: "absolute", top: 12, right: 12, width: 30, height: 30,
                                borderRadius: "50%", background: "rgba(255,255,255,0.92)",
                                border: "none", cursor: "pointer", fontSize: 16, color: C.ink,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontFamily: "inherit"
                            }}>{"×"}</button>
                            {proteinDensity > 0 && (
                                <div style={{
                                    position: "absolute", bottom: 12, left: 12,
                                    background: proteinDensity >= 8 ? C.green : C.teal,
                                    color: C.white, fontSize: 10, fontWeight: 700,
                                    padding: "4px 10px", borderRadius: 8, letterSpacing: "0.06em"
                                }}>
                                    {proteinDensity}g protein / 100 cal
                                </div>
                            )}
                        </div>

                        <div style={{ padding: "18px 20px 36px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                            <div>
                                <h3 style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: "0 0 3px", lineHeight: 1.2 }}>{sel.title}</h3>
                                {sel.category && <div style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.12em" }}>{sel.category}</div>}
                            </div>

                            {/* Portion toggle */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 6 }}>Portion size</div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {portionLabels.map(p => (
                                        <button key={p.val} onClick={() => setPortion(p.val)} style={{
                                            flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                            cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                                            border: `1.5px solid ${portion === p.val ? C.orange : C.border}`,
                                            background: portion === p.val ? C.orangeLight : "transparent",
                                            color: portion === p.val ? C.orange : C.inkFaint
                                        }}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Macro ring */}
                            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px", background: C.inkGhost, borderRadius: 12 }}>
                                <MacroRing protein={scaledProtein} carbs={scaledCarbs} fat={scaledFat} calories={scaledCalories} />
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <MacroStat label="Protein" value={scaledProtein} unit="g" color={C.orange} />
                                    <MacroStat label="Carbs"   value={scaledCarbs}   unit="g" color={C.yellow} />
                                    {scaledFat > 0 && <MacroStat label="Fat" value={scaledFat} unit="g" color={C.green} />}
                                </div>
                            </div>

                            {/* Budget impact */}
                            {budget > 0 && scaledCalories > 0 && (
                                <div style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "9px 13px", borderRadius: 10,
                                    background: C.tealLight, border: `1px solid ${C.teal}`
                                }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>This bowl</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{scaledCalories} cal</span>
                                    <span style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>{Math.round((scaledCalories / budget) * 100)}% of daily goal</span>
                                </div>
                            )}

                            {/* Goal fit indicator */}
                            {goal !== "all" && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "10px 13px", borderRadius: 10,
                                    background: swapTip ? C.orangeLight : C.greenLight,
                                    borderLeft: `3px solid ${swapTip ? C.orange : C.green}`
                                }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: swapTip ? C.orange : C.green, textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 58 }}>
                                        {swapTip ? "Tweak it" : "Great fit"}
                                    </div>
                                    <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
                                        {swapTip ?? "This item aligns well with your " + (GOALS.find(g => g.id === goal)?.label ?? "") + " goal."}
                                    </div>
                                </div>
                            )}

                            {sel.description && (
                                <p style={{ fontSize: 13, color: C.inkFaint, margin: 0, lineHeight: 1.7 }}>{sel.description}</p>
                            )}

                            {sel.ingredients && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 5 }}>Ingredients</div>
                                    <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.75, opacity: 0.75 }}>{sel.ingredients}</div>
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                                <a href={orderUrl} target="_blank" rel="noopener noreferrer" style={{
                                    display: "block", textAlign: "center", padding: "14px",
                                    borderRadius: 10, background: C.orange, color: C.white,
                                    fontWeight: 700, fontSize: 14, textDecoration: "none",
                                    fontFamily: "inherit", letterSpacing: "0.01em"
                                }}>
                                    {n(sel.price) > 0 ? `Order Now — $${n(sel.price).toFixed(2)}` : "Order Now"}
                                </a>
                                <button onClick={() => {
                                    if (typeof window !== "undefined") {
                                        const url = new URL(window.location.href)
                                        url.searchParams.set("item", sel.title)
                                        navigator.clipboard?.writeText(url.toString())
                                    }
                                }} style={{
                                    padding: "11px", borderRadius: 10, border: `1.5px solid ${C.border}`,
                                    background: "none", color: C.ink, fontWeight: 600,
                                    fontSize: 12, cursor: "pointer", fontFamily: "inherit"
                                }}>
                                    Copy shareable link
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Comparison tray ───────────────────────────────────────── */}
            {tray.length > 0 && (
                <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
                    background: C.ink, borderTop: `1px solid rgba(255,255,255,0.08)`,
                    transition: "transform 0.2s ease"
                }}>
                    {/* Tray toggle bar */}
                    <button
                        onClick={() => setTrayOpen(p => !p)}
                        style={{
                            width: "100%", padding: "10px 32px", display: "flex", alignItems: "center",
                            justifyContent: "space-between", background: "none", border: "none",
                            cursor: "pointer", fontFamily: "inherit"
                        }}
                    >
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.cream, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Compare {tray.length} bowl{tray.length > 1 ? "s" : ""}
                        </span>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: C.inkFaint }}>
                                {trayTotals.calories} cal · {trayTotals.protein}g protein · {trayTotals.carbs}g carbs combined
                            </span>
                            <span style={{ fontSize: 14, color: "rgba(245,238,227,0.50)" }}>{trayOpen ? "▼" : "▲"}</span>
                        </div>
                    </button>

                    {/* Expanded tray */}
                    {trayOpen && (
                        <div style={{ padding: "0 32px 20px", display: "flex", gap: 16, overflowX: "auto" }}>
                            {trayItems.map((item: MenuItem) => (
                                <div key={item.title} style={{
                                    flexShrink: 0, width: 200, background: "rgba(255,255,255,0.05)",
                                    borderRadius: 10, overflow: "hidden", border: `1px solid rgba(255,255,255,0.08)`
                                }}>
                                    {item.thumbnail && (
                                        <img src={item.thumbnail} alt={item.title} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                                    )}
                                    <div style={{ padding: "10px 12px" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, marginBottom: 6 }}>{item.title}</div>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>{n(item.protein)}g pro</span>
                                            <span style={{ fontSize: 11, color: C.yellow, fontWeight: 700 }}>{n(item.carbs)}g carb</span>
                                            <span style={{ fontSize: 11, color: C.inkFaint, fontWeight: 600 }}>{n(item.calories)} cal</span>
                                        </div>
                                        <button onClick={() => toggleTray(item.title)} style={{
                                            marginTop: 8, padding: "4px 10px", borderRadius: 6,
                                            border: `1px solid rgba(255,255,255,0.15)`, background: "none",
                                            color: "rgba(245,238,227,0.60)", fontSize: 11, cursor: "pointer", fontFamily: "inherit"
                                        }}>
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ flexShrink: 0, width: 200, background: "rgba(252,97,45,0.12)", borderRadius: 10, padding: "14px 16px", border: `1px solid rgba(252,97,45,0.25)`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Combined total</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.cream, marginBottom: 2 }}>{trayTotals.calories}<span style={{ fontSize: 12, color: C.inkFaint }}> cal</span></div>
                                <div style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{trayTotals.protein}g protein</div>
                                <div style={{ fontSize: 12, color: C.yellow, fontWeight: 600 }}>{trayTotals.carbs}g carbs</div>
                                {budget > 0 && (
                                    <div style={{ marginTop: 10, fontSize: 11, color: trayTotals.calories <= budget ? C.green : C.orange, fontWeight: 700 }}>
                                        {trayTotals.calories <= budget ? `${budget - trayTotals.calories} cal under budget` : `${trayTotals.calories - budget} cal over budget`}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default NutritionCalculator

addPropertyControls(NutritionCalculator, {
    items: {
        type: ControlType.Array,
        title: "Items",
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
    orderUrl: {
        type: ControlType.String,
        title: "Order URL",
        defaultValue: "#",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font Family",
        defaultValue: "Bricolage Grotesque, sans-serif",
    },
})

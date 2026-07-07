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

// Wild Eggs brand tokens — sourced from the project's Nutrition_Panel.tsx and color styles:
// Teal #2f5c64 (primary), Paprika #af3c23 (action), Gold #b58222 (accent),
// Deep Green #126849, Cream #faf7f0 (canvas), Cast-Iron Brown #1e1a14 (text).
const C = {
    orange:      "rgb(175, 60, 35)",    // Paprika — action color (5.9:1 on white, AA)
    orangeDark:  "rgb(148, 50, 29)",    // deeper paprika for large fills / text emphasis
    orangeLight: "rgba(175, 60, 35, 0.10)",
    yellow:      "rgb(181, 130, 34)",   // Gold accent
    amber:       "rgb(140, 100, 25)",   // AA-compliant gold when used as text on white
    green:       "rgb(18, 104, 73)",    // Deep Green (6.7:1 with white text, AA)
    greenDark:   "rgb(13, 78, 55)",
    greenLight:  "rgba(18, 104, 73, 0.10)",
    teal:        "rgb(47, 92, 100)",    // Teal 1 - primary brand
    tealLight:   "rgba(47, 92, 100, 0.08)",
    cream:       "rgb(250, 247, 240)",  // Canvas cream
    white:       "rgb(255, 255, 255)",
    ink:         "rgb(30, 26, 20)",     // Cast-iron brown
    inkSoft:     "rgba(30, 26, 20, 0.65)",
    inkGhost:    "rgba(30, 26, 20, 0.07)",
    border:      "rgba(30, 26, 20, 0.09)",
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
    // accentText per fill: cream on the dark paprika/green fills (5.9:1 / 6.7:1 AA),
    // ink on gold (5.0:1 AA) — white on gold would fail at 3.4:1.
    { id: "power", label: "Power Up",      sub: "30g+ protein",  accent: C.orange, accentText: C.cream, minProtein: 30 },
    { id: "light", label: "Keep It Light", sub: "Under 500 cal", accent: C.green,  accentText: C.cream, maxCalories: 500 },
    { id: "fuel",  label: "Fuel the Day",  sub: "Carb-forward",  accent: C.yellow, accentText: C.ink,   minCarbs: 50 },
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
const DEFAULT_ITEMS: MenuItem[] = [{"id":"wTdutXQmk","title":"Strawberry House Lemonade","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":3.99,"ingredients":"Strawberry house lemonade (12oz)","shortIngr":"Strawberry house lemonade (12oz)","description":"Strawberry house lemonade (12oz)","thumbnail":"https://framerusercontent.com/images/HHqM8ggjItyB8imNFtj9tRv9C0I.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"XRdgQtt0P","title":"Zax I Am Fried Eggs","calories":640,"protein":19,"carbs":49,"fat":39,"category":"Breakfast Mains","price":8.99,"ingredients":"Two eggs any style with home fries and an Everything muffin. Add ham, jalapeño, sausage, Canadian bacon, or turkey sausage for $3.69.","shortIngr":"Two eggs any style with home fries and an Everything muffin.","description":"Two eggs any style with home fries and an Everything muffin. Add ham, jalapeño, sausage, Canadian bacon, or turkey sausage for $3.69.","thumbnail":"https://framerusercontent.com/images/GMbfdrqVvrukrxQAlUQZFK8Rjss.jpg","sodium":1060,"fiber":2,"sugars":13,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"IaWgWOAbw","title":"Old Fashioned Oatmeal","calories":390,"protein":13,"carbs":66,"fat":9,"category":"Breakfast Mains","price":8.99,"ingredients":"Oatmeal made to order with your choice of three toppings: cream, butter, brown sugar, cinnamon, candied pecans, strawberries, or blueberries.","shortIngr":"Oatmeal made to order with your choice of three toppings: cr","description":"Oatmeal made to order with your choice of three toppings: cream, butter, brown sugar, cinnamon, candied pecans, strawberries, or blueberries.","thumbnail":"https://framerusercontent.com/images/ZLJjA8UPXjDkTsIGEXmkfLAzNvs.jpg","sodium":10,"fiber":10,"sugars":1,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"o8fd_bW8u","title":"Biscuits & Gravy","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Breakfast Mains","price":9.99,"ingredients":"Buttermilk biscuits topped with house-made bacon gravy, chorizo gravy, or both.","shortIngr":"Buttermilk biscuits topped with house-made bacon gravy, chor","description":"Buttermilk biscuits topped with house-made bacon gravy, chorizo gravy, or both.","thumbnail":"https://framerusercontent.com/images/7XLLw3Vq1ARS1N6da1A2CKG4.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"HEmibs5Qe","title":"House-Made Cinnamon Roll","calories":1290,"protein":20,"carbs":171,"fat":60,"category":"Breakfast Mains","price":9.99,"ingredients":"Cinnamon roll filled with butter, brown sugar, and cinnamon, baked in a cast-iron skillet and topped with sweet vanilla bean icing.","shortIngr":"Cinnamon roll filled with butter, brown sugar, and cinnamon,","description":"Cinnamon roll filled with butter, brown sugar, and cinnamon, baked in a cast-iron skillet and topped with sweet vanilla bean icing.","thumbnail":"https://framerusercontent.com/images/aAuoEBUHwI7uR5TuA33O00k4c08.jpg","sodium":2430,"fiber":5,"sugars":83,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"klxunvd8P","title":"Avocado Toast","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Breakfast Mains","price":12.99,"ingredients":"Bruschetta and a balsamic glaze over fresh avocado on wheatberry toast, served with fruit.","shortIngr":"Bruschetta and a balsamic glaze over fresh avocado on wheatb","description":"Bruschetta and a balsamic glaze over fresh avocado on wheatberry toast, served with fruit.","thumbnail":"https://framerusercontent.com/images/Smd3iYPiQvcEakqjoKFBqfGxDAY.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"lioAuIdZh","title":"Surfer Girl","calories":640,"protein":36,"carbs":15,"fat":50,"category":"Breakfast Mains","price":13.99,"ingredients":"Fresh spinach, wild mushrooms, tomato, cream cheese, and onion. Topped with avocado, pico de gallo, sour cream, and green onions.","shortIngr":"Fresh spinach, wild mushrooms, tomato, cream cheese, and oni","description":"Fresh spinach, wild mushrooms, tomato, cream cheese, and onion. Topped with avocado, pico de gallo, sour cream, and green onions.","thumbnail":"https://framerusercontent.com/images/tBpZzgsdAIqdccqxhgq5izMU.jpg","sodium":610,"fiber":4,"sugars":7,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ugas1na5u","title":"Southwest Steak & Cheese","calories":800,"protein":56,"carbs":8,"fat":60,"category":"Breakfast Mains","price":14.99,"ingredients":"Stuffed with shaved steak, bell peppers, onions, and spicy pepper jack cheese. Served with pico de gallo.","shortIngr":"Stuffed with shaved steak, bell peppers, onions, and spicy p","description":"Stuffed with shaved steak, bell peppers, onions, and spicy pepper jack cheese. Served with pico de gallo.","thumbnail":"https://framerusercontent.com/images/nOs0ZLokWkGq4L39qUloB9vFI.jpg","sodium":640,"fiber":1,"sugars":4,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"lV4xZhtqx","title":"Buffalo Chicken","calories":1030,"protein":56,"carbs":8,"fat":86,"category":"Breakfast Mains","price":13.99,"ingredients":"Pulled chicken breast, cream cheese, and melted cheddar jack. Topped with buffalo ranch sauce and green onions.","shortIngr":"Pulled chicken breast, cream cheese, and melted cheddar jack","description":"Pulled chicken breast, cream cheese, and melted cheddar jack. Topped with buffalo ranch sauce and green onions.","thumbnail":"https://framerusercontent.com/images/k055bOvIDbgKxYlEr9xtjF2SvY.jpg","sodium":2290,"fiber":1,"sugars":5,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"fWr5QlEPG","title":"Wild Western","calories":590,"protein":44,"carbs":11,"fat":42,"category":"Breakfast Mains","price":13.99,"ingredients":"Ham, jalapeño, onion, and cheddar jack cheese. Topped with pico de gallo and green onions.","shortIngr":"Ham, jalapeño, onion, and cheddar jack cheese. Topped with p","description":"Ham, jalapeño, onion, and cheddar jack cheese. Topped with pico de gallo and green onions.","thumbnail":"https://framerusercontent.com/images/UlnyEomzY39Ouwr9jNxurZHxQ.jpg","sodium":970,"fiber":3,"sugars":6,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"K31n0OQTs","title":"Build Your Own Omelet or Scramble","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Breakfast Mains","price":10.99,"ingredients":"Starts with four jumbo eggs and your choice of ingredients. Meats, cheeses, and vegetables available; egg whites at no charge.","shortIngr":"Starts with four jumbo eggs and your choice of ingredients. ","description":"Starts with four jumbo eggs and your choice of ingredients. Meats, cheeses, and vegetables available; egg whites at no charge.","thumbnail":"https://framerusercontent.com/images/fB00gp8xmYd2I5K7bpGx9ALtAAo.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"FYvxeap9k","title":"The Mad Platter","calories":1790,"protein":59,"carbs":86,"fat":136,"category":"Breakfast Mains","price":16.99,"ingredients":"Three eggs cooked your way with bacon, sausage, home fries or stone-ground grits, your choice of bread, and a large buttermilk pancake. Gluten-friendly option available.","shortIngr":"Three eggs cooked your way with bacon, sausage, home fries o","description":"Three eggs cooked your way with bacon, sausage, home fries or stone-ground grits, your choice of bread, and a large buttermilk pancake. Gluten-friendly option available.","thumbnail":"https://framerusercontent.com/images/vcGNjy0fDwtr9VmNwVayohuIJI.jpg","sodium":3110,"fiber":6,"sugars":15,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"y00_fc9SO","title":"Steak and Eggs","calories":740,"protein":53,"carbs":1,"fat":57,"category":"Breakfast Mains","price":19.99,"ingredients":"Seasoned grilled NY strip with two eggs any style, served with home fries and an Everything muffin.","shortIngr":"Seasoned grilled NY strip with two eggs any style, served wi","description":"Seasoned grilled NY strip with two eggs any style, served with home fries and an Everything muffin.","thumbnail":"https://framerusercontent.com/images/kryM4lntHkGeMxCpXQHPF7RUfw.jpg","sodium":760,"fiber":0,"sugars":1,"allergens":["egg"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"WTSFqHsrH","title":"Eggs Bennie","calories":720,"protein":38,"carbs":26,"fat":51,"category":"Bonnie's Bennies","price":13.49,"ingredients":"Toasted English muffin, Canadian bacon, poached eggs, fresh hollandaise, and smoked paprika. Served with your choice of home fries or grits.","shortIngr":"Toasted English muffin, Canadian bacon, poached eggs, fresh ","description":"Toasted English muffin, Canadian bacon, poached eggs, fresh hollandaise, and smoked paprika. Served with your choice of home fries or grits.","thumbnail":"https://framerusercontent.com/images/LHhbjzOF2C8Cuzg9bqWRWmW0v4.jpg","sodium":1990,"fiber":1,"sugars":6,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"tfWixXOwD","title":"Veggie Bennie","calories":750,"protein":21,"carbs":29,"fat":63,"category":"Bonnie's Bennies","price":13.49,"ingredients":"Toasted English muffin, sautéed spinach, tomatoes, garlic, poached eggs, fresh hollandaise, and smoked paprika. Served with your choice of home fries or grits.","shortIngr":"Toasted English muffin, sautéed spinach, tomatoes, garlic, p","description":"Toasted English muffin, sautéed spinach, tomatoes, garlic, poached eggs, fresh hollandaise, and smoked paprika. Served with your choice of home fries or grits.","thumbnail":"https://framerusercontent.com/images/qLO9CAwVPrkDkl9eh2zZS16So.jpg","sodium":1160,"fiber":4,"sugars":3,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"qfp1WX6yW","title":"Country Fried Steak","calories":860,"protein":47,"carbs":52,"fat":51,"category":"Breakfast Mains","price":14.99,"ingredients":"Hand-breaded sirloin topped with white bacon gravy. Served with two fried eggs, home fries, and an Everything muffin.","shortIngr":"Hand-breaded sirloin topped with white bacon gravy. Served w","description":"Hand-breaded sirloin topped with white bacon gravy. Served with two fried eggs, home fries, and an Everything muffin.","thumbnail":"https://framerusercontent.com/images/L7Jmhl6YOqppCqDPVKPOSTwrA.jpg","sodium":1670,"fiber":2,"sugars":5,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"O2yUOfMjH","title":"Steak Bennie","calories":990,"protein":57,"carbs":23,"fat":73,"category":"Bonnie's Bennies","price":19.99,"ingredients":"New York strip with two poached eggs on a grilled English muffin, topped with fresh hollandaise. Served with home fries.","shortIngr":"New York strip with two poached eggs on a grilled English mu","description":"New York strip with two poached eggs on a grilled English muffin, topped with fresh hollandaise. Served with home fries.","thumbnail":"https://framerusercontent.com/images/k6q2HUVcjn1BuvCLORvBKHc2aU.jpg","sodium":1760,"fiber":2,"sugars":2,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"m36pu68bK","title":"Kalamity Katie's Border Benedict","calories":1010,"protein":37,"carbs":58,"fat":72,"category":"Breakfast Mains","price":13.99,"ingredients":"Green chili cheddar corn cakes topped with chorizo, two poached eggs, queso fundido, pico de gallo, sour cream, green onions, and avocado. Served with home fries and your choice of bread.","shortIngr":"Green chili cheddar corn cakes topped with chorizo, two poac","description":"Green chili cheddar corn cakes topped with chorizo, two poached eggs, queso fundido, pico de gallo, sour cream, green onions, and avocado. Served with home fries and your choice of bread.","thumbnail":"https://framerusercontent.com/images/bnzkwZjQ4qzmS3uSREC9HHj9U0.png","sodium":2030,"fiber":4,"sugars":19,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"vtBGO0FXD","title":"Kelsey KY Brown","calories":850,"protein":40,"carbs":33,"fat":62,"category":"Breakfast Mains","price":14.99,"ingredients":"Award-winning. Toasted sourdough, roasted turkey, applewood smoked bacon, diced tomato, white cheddar mornay, a fried egg, and smoked paprika.","shortIngr":"Award-winning. Toasted sourdough, roasted turkey, applewood ","description":"Award-winning. Toasted sourdough, roasted turkey, applewood smoked bacon, diced tomato, white cheddar mornay, a fried egg, and smoked paprika.","thumbnail":"https://framerusercontent.com/images/bbur7DHkz18ujAfl4aC2HWB2qxE.jpg","sodium":1840,"fiber":2,"sugars":5,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"oIygDEdm8","title":"Breakfast Burrito","calories":1420,"protein":55,"carbs":87,"fat":98,"category":"Breakfast Mains","price":14.99,"ingredients":"Flour tortilla stuffed with scrambled eggs, chorizo, cheddar jack cheese, poblano pepper, and onion. Topped with queso, sour cream, pico de gallo, avocado, and green onion. Served with home fries and black beans.","shortIngr":"Flour tortilla stuffed with scrambled eggs, chorizo, cheddar","description":"Flour tortilla stuffed with scrambled eggs, chorizo, cheddar jack cheese, poblano pepper, and onion. Topped with queso, sour cream, pico de gallo, avocado, and green onion. Served with home fries and black beans.","thumbnail":"https://framerusercontent.com/images/jbwrKzdCyXMzujXX8ZT3zu5HU.jpg","sodium":2500,"fiber":8,"sugars":8,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Dznw4mDXt","title":"Mexico City Chilaquiles","calories":730,"protein":26,"carbs":45,"fat":46,"category":"Breakfast Mains","price":13.99,"ingredients":"Corn tortillas, beans, salsa verde, queso blanco, an egg any style, and your choice of pulled chicken or ground chorizo. Served with home fries and a shot of jugo de limón y chile.","shortIngr":"Corn tortillas, beans, salsa verde, queso blanco, an egg any","description":"Corn tortillas, beans, salsa verde, queso blanco, an egg any style, and your choice of pulled chicken or ground chorizo. Served with home fries and a shot of jugo de limón y chile.","thumbnail":"https://framerusercontent.com/images/uArhWqgBJwEDkuEUVJmSyq4Ic.jpg","sodium":1880,"fiber":9,"sugars":2,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"RpACMfrBD","title":"Farmer's Market Skillet","calories":650,"protein":25,"carbs":35,"fat":48,"category":"Breakfast Mains","price":13.99,"ingredients":"Bell pepper, onion, zucchini, yellow squash, wild mushrooms, home fries, broccoli, oven-roasted tomato, melted cheddar jack cheese, two basted eggs, and an Everything muffin. Gluten-friendly option available.","shortIngr":"Bell pepper, onion, zucchini, yellow squash, wild mushrooms,","description":"Bell pepper, onion, zucchini, yellow squash, wild mushrooms, home fries, broccoli, oven-roasted tomato, melted cheddar jack cheese, two basted eggs, and an Everything muffin. Gluten-friendly option available.","thumbnail":"https://framerusercontent.com/images/LduT6z6Pgmzi76Fe5JDBM8kjOJc.jpg","sodium":990,"fiber":6,"sugars":6,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"oKfuJRJjJ","title":"Potato Head Casserole","calories":890,"protein":31,"carbs":30,"fat":72,"category":"Breakfast Mains","price":13.99,"ingredients":"Hashbrown potatoes baked with sour cream, diced onions, spices, and cheddar jack cheese. Topped with breakfast sausage, diced tomatoes, poblano pepper, mushrooms, queso, onions, and an egg your way.","shortIngr":"Hashbrown potatoes baked with sour cream, diced onions, spic","description":"Hashbrown potatoes baked with sour cream, diced onions, spices, and cheddar jack cheese. Topped with breakfast sausage, diced tomatoes, poblano pepper, mushrooms, queso, onions, and an egg your way.","thumbnail":"https://framerusercontent.com/images/dkttfaj1aZfFFpBHKcrbvOfswMs.jpg","sodium":2090,"fiber":2,"sugars":7,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"p8S2tfSra","title":"The Carolina Casserole","calories":1300,"protein":37,"carbs":54,"fat":102,"category":"Breakfast Mains","price":14.99,"ingredients":"Home fries, bell pepper, onion, diced ham, crumbled bacon, cheddar cheese, Monterey jack cheese, and white bacon gravy, topped with two eggs your way. Served with your choice of bread or a fresh muffin.","shortIngr":"Home fries, bell pepper, onion, diced ham, crumbled bacon, c","description":"Home fries, bell pepper, onion, diced ham, crumbled bacon, cheddar cheese, Monterey jack cheese, and white bacon gravy, topped with two eggs your way. Served with your choice of bread or a fresh muffin.","thumbnail":"https://framerusercontent.com/images/4QaOD7JeAlRg3ryTfFNT0Q0RjAY.jpg","sodium":2380,"fiber":3,"sugars":8,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"B80Waibsq","title":"Strawberry Tall Cakes","calories":1190,"protein":25,"carbs":167,"fat":45,"category":"Pancakes, Waffles & Sweets","price":12.99,"ingredients":"Buttermilk cakes, fresh strawberries, strawberry compote, whipped cream, and powdered sugar. Make them Blueberry Tall Cakes. Gluten-friendly option available.","shortIngr":"Buttermilk cakes, fresh strawberries, strawberry compote, wh","description":"Buttermilk cakes, fresh strawberries, strawberry compote, whipped cream, and powdered sugar. Make them Blueberry Tall Cakes. Gluten-friendly option available.","thumbnail":"https://framerusercontent.com/images/14GZv2R6ITWHZVP8BAVEZ58dWQY.jpg","sodium":1310,"fiber":3,"sugars":108,"allergens":["egg","milk","soy","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"X0AezFhR8","title":"Big Stack","calories":1270,"protein":33,"carbs":150,"fat":58,"category":"Pancakes, Waffles & Sweets","price":9.99,"ingredients":"Three buttermilk cakes with whipped butter and powdered sugar. Gluten-friendly option available.","shortIngr":"Three buttermilk cakes with whipped butter and powdered suga","description":"Three buttermilk cakes with whipped butter and powdered sugar. Gluten-friendly option available.","thumbnail":"https://framerusercontent.com/images/G7c90foDSlw0m0oz9adkAhoMM.jpg","sodium":2640,"fiber":5,"sugars":42,"allergens":["egg","milk","soy","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"UYPsWPJQp","title":"Belgian Waffle","calories":530,"protein":7,"carbs":49,"fat":33,"category":"Pancakes, Waffles & Sweets","price":9.99,"ingredients":"Belgian waffle served with whipped butter and powdered sugar.","shortIngr":"Belgian waffle served with whipped butter and powdered sugar","description":"Belgian waffle served with whipped butter and powdered sugar.","thumbnail":"https://framerusercontent.com/images/RWw22P2d96cpOco4lCkBgcafOvg.jpg","sodium":1020,"fiber":1,"sugars":4,"allergens":["egg","milk","soy","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ccPGCRO8N","title":"Chicken & Waffle","calories":1600,"protein":67,"carbs":118,"fat":94,"category":"Pancakes, Waffles & Sweets","price":15.99,"ingredients":"Seasoned chicken-infused waffle, Nashville hot chicken breast, chopped bacon, and house-made buttermilk maple syrup.","shortIngr":"Seasoned chicken-infused waffle, Nashville hot chicken breas","description":"Seasoned chicken-infused waffle, Nashville hot chicken breast, chopped bacon, and house-made buttermilk maple syrup.","thumbnail":"https://framerusercontent.com/images/fjskuqvIAj0HKl3dwDnktiMVIs.jpg","sodium":3830,"fiber":4,"sugars":48,"allergens":["egg","milk","soy","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"T3n97Bfpq","title":"Stuffed French Toast","calories":570,"protein":10,"carbs":71,"fat":27,"category":"Pancakes, Waffles & Sweets","price":13.49,"ingredients":"Thick-sliced sourdough, sweetened cream cheese, blueberries, strawberries, powdered sugar, cinnamon, and whipped cream. Gluten-friendly option available.","shortIngr":"Thick-sliced sourdough, sweetened cream cheese, blueberries,","description":"Thick-sliced sourdough, sweetened cream cheese, blueberries, strawberries, powdered sugar, cinnamon, and whipped cream. Gluten-friendly option available.","thumbnail":"https://framerusercontent.com/images/cRYNDusaAbZZK9mtD6vrwkGI.jpg","sodium":490,"fiber":5,"sugars":25,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"MhYs7wJej","title":"Classic French Toast","calories":590,"protein":10,"carbs":65,"fat":31,"category":"Pancakes, Waffles & Sweets","price":11.99,"ingredients":"Thick-sliced sourdough dipped in brandied egg batter with whipped butter, syrup, powdered sugar, and cinnamon. Gluten-friendly option available.","shortIngr":"Thick-sliced sourdough dipped in brandied egg batter with wh","description":"Thick-sliced sourdough dipped in brandied egg batter with whipped butter, syrup, powdered sugar, and cinnamon. Gluten-friendly option available.","thumbnail":"https://framerusercontent.com/images/1cN69du1GOsHh9BMNoigxNUBYs.jpg","sodium":730,"fiber":3,"sugars":6,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"idf47w1B4","title":"Grilled Chicken Salad","calories":740,"protein":62,"carbs":24,"fat":44,"category":"Lunch & Sandwiches","price":13.99,"ingredients":"Fresh mixed greens topped with shredded cheese, tomatoes, eggs, avocado, onions, bacon, and fresh-grilled chicken breast. Served with house-made balsamic vinaigrette.","shortIngr":"Fresh mixed greens topped with shredded cheese, tomatoes, eg","description":"Fresh mixed greens topped with shredded cheese, tomatoes, eggs, avocado, onions, bacon, and fresh-grilled chicken breast. Served with house-made balsamic vinaigrette.","thumbnail":"https://framerusercontent.com/images/WDSxDUwuw44UMD4fBZ8VJdHZdwQ.jpg","sodium":2500,"fiber":10,"sugars":9,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ODAGjJuF4","title":"Classic Burger","calories":660,"protein":39,"carbs":43,"fat":36,"category":"Lunch & Sandwiches","price":13.99,"ingredients":"Two beef patties with your choice of cheese, lettuce, tomato, and red onion on a fresh toasted brioche bun. Served with your choice of french fries or skillet potatoes. Get Wild: Add fried egg or bacon $1.49. Add mushrooms or grilled onions $0.49.","shortIngr":"Two beef patties with your choice of cheese, lettuce, tomato","description":"Two beef patties with your choice of cheese, lettuce, tomato, and red onion on a fresh toasted brioche bun. Served with your choice of french fries or skillet potatoes. Get Wild: Add fried egg or bacon $1.49. Add mushrooms or grilled onions $0.49.","thumbnail":"https://framerusercontent.com/images/IfyCGYtDODwX1ix6oGvKZkoZKIY.jpg","sodium":1770,"fiber":0,"sugars":7,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"vmtEm6Aqq","title":"Pops' Popping Egg Salad","calories":740,"protein":29,"carbs":46,"fat":49,"category":"Lunch & Sandwiches","price":12.99,"ingredients":"Award-winning house-made deviled egg salad, Habagardil pickles, shredded lettuce, and sliced tomato on toasted sourdough.","shortIngr":"Award-winning house-made deviled egg salad, Habagardil pickl","description":"Award-winning house-made deviled egg salad, Habagardil pickles, shredded lettuce, and sliced tomato on toasted sourdough.","thumbnail":"https://framerusercontent.com/images/bJeoj64P2nVAjRzjXvJ6JqVHwM.jpg","sodium":1650,"fiber":3,"sugars":6,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"UctjRPKeF","title":"ACE OF A BLT","calories":1000,"protein":44,"carbs":47,"fat":74,"category":"Lunch & Sandwiches","price":13.99,"ingredients":"Avocado, cheddar, fried egg, bacon, lettuce, and tomato on toasted sourdough.","shortIngr":"Avocado, cheddar, fried egg, bacon, lettuce, and tomato on t","description":"Avocado, cheddar, fried egg, bacon, lettuce, and tomato on toasted sourdough.","thumbnail":"https://framerusercontent.com/images/eaIIHq2PxsCMztph0425PsOABk.jpg","sodium":1670,"fiber":6,"sugars":4,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"mevLxz1SP","title":"Breakfast Sammie","calories":1050,"protein":42,"carbs":44,"fat":80,"category":"Breakfast Mains","price":12.99,"ingredients":"Two scrambled eggs with cheddar cheese, green onions, avocado, and bacon on a brioche bun with chipotle mayo.","shortIngr":"Two scrambled eggs with cheddar cheese, green onions, avocad","description":"Two scrambled eggs with cheddar cheese, green onions, avocado, and bacon on a brioche bun with chipotle mayo.","thumbnail":"https://framerusercontent.com/images/j0fC0oILAb12zK6VvIqn3POT3I.jpg","sodium":1530,"fiber":3,"sugars":6,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"SoKZqHUP0","title":"Wild Club","calories":1040,"protein":57,"carbs":48,"fat":68,"category":"Lunch & Sandwiches","price":14.99,"ingredients":"Sliced ham, smoked turkey, and bacon between two slices of grilled sourdough, topped with cheddar cheese, lettuce, tomato, and chipotle mayo.","shortIngr":"Sliced ham, smoked turkey, and bacon between two slices of g","description":"Sliced ham, smoked turkey, and bacon between two slices of grilled sourdough, topped with cheddar cheese, lettuce, tomato, and chipotle mayo.","thumbnail":"https://framerusercontent.com/images/sJ4XQHm9pVv06c1ONHkxfz7sds.jpg","sodium":3330,"fiber":3,"sugars":5,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"N5wByzS5y","title":"Yellow Submarine","calories":1240,"protein":54,"carbs":51,"fat":83,"category":"Lunch & Sandwiches","price":14.99,"ingredients":"Scrambled eggs, American cheese, grilled shaved ham, and applewood-smoked bacon on a toasted hoagie roll with mayo, lettuce, tomato, red onion, and Habagardil pickle chips.","shortIngr":"Scrambled eggs, American cheese, grilled shaved ham, and app","description":"Scrambled eggs, American cheese, grilled shaved ham, and applewood-smoked bacon on a toasted hoagie roll with mayo, lettuce, tomato, red onion, and Habagardil pickle chips.","thumbnail":"https://framerusercontent.com/images/BxHwQPgXMIgupbHCA85apnCZiw.jpg","sodium":3400,"fiber":3,"sugars":8,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"R8W5IEOEi","title":"Stone-Ground Grits","calories":130,"protein":1,"carbs":15,"fat":6,"category":"Sides","price":2.99,"ingredients":"Traditional Southern-style stone-ground grits, slow-cooked for a creamy texture. Available as a side dish or as part of signature platters at all locations.","shortIngr":"Traditional Southern-style stone-ground grits, slow-cooked f","description":"Traditional Southern-style stone-ground grits, slow-cooked for a creamy texture. Available as a side dish or as part of signature platters at all locations.","thumbnail":"https://framerusercontent.com/images/7tDrNquzD80oDPKK1u8T4NCgX4.png","sodium":750,"fiber":2,"sugars":0,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"LVhBocKlK","title":"Gluten-Free Toast","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Sides","price":2.0,"ingredients":"Gluten-free toast.","shortIngr":"Gluten-free toast.","description":"Gluten-free toast.","thumbnail":"https://framerusercontent.com/images/W7eEDVkRByKFBNd6NjciWywH7k.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"I6P14dzjx","title":"Skillet Potatoes","calories":230,"protein":4,"carbs":34,"fat":9,"category":"Sides","price":4.99,"ingredients":"Side of skillet potatoes (crispy or regular) with gluten-free option available.","shortIngr":"Side of skillet potatoes (crispy or regular) with gluten-fre","description":"Side of skillet potatoes (crispy or regular) with gluten-free option available.","thumbnail":"https://framerusercontent.com/images/LevRrfvFg2JlSRVQvq8zVX2L4.png","sodium":750,"fiber":4,"sugars":4,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"cbpoRvMTo","title":"French Fries","calories":440,"protein":2,"carbs":38,"fat":30,"category":"Sides","price":4.99,"ingredients":"","shortIngr":"","description":"","thumbnail":"https://framerusercontent.com/images/XFKORvUAGmnbRmITHTfZrX0wUnI.png","sodium":1500,"fiber":0,"sugars":2,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"NI4F9lQVu","title":"Sautéed Spinach","calories":150,"protein":3,"carbs":4,"fat":15,"category":"Sides","price":3.99,"ingredients":"","shortIngr":"","description":"","thumbnail":"https://framerusercontent.com/images/5MqB5Uurrq0fV0QymoAtCuSxsQ.png","sodium":540,"fiber":2,"sugars":1,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"H43ZJNaSv","title":"Side of Vegetables","calories":40,"protein":1,"carbs":4,"fat":2,"category":"Sides","price":3.99,"ingredients":"We rotate our fresh vegetables regularly. Ask what we're featuring today!","shortIngr":"We rotate our fresh vegetables regularly. Ask what we're fea","description":"We rotate our fresh vegetables regularly. Ask what we're featuring today!","thumbnail":"https://framerusercontent.com/images/JZo8dm0wPtQTeJ4cSINdAjl9eHM.png","sodium":1970,"fiber":0,"sugars":1,"allergens":["soy"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"H9LQsrM8N","title":"Pancake","calories":530,"protein":11,"carbs":51,"fat":30,"category":"Sides","price":4.99,"ingredients":"Side pancake with whipped butter and powdered sugar.","shortIngr":"Side pancake with whipped butter and powdered sugar.","description":"Side pancake with whipped butter and powdered sugar.","thumbnail":"https://framerusercontent.com/images/pYwhkoPOLbPAGiRUzP0JW3c14gs.jpg","sodium":990,"fiber":2,"sugars":16,"allergens":["egg","milk","soy","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"WuBNsVD3R","title":"French Toast","calories":310,"protein":3,"carbs":24,"fat":21,"category":"Sides","price":4.99,"ingredients":"Side French Toast with whipped butter, powdered sugar and cinnamon.","shortIngr":"Side French Toast with whipped butter, powdered sugar and ci","description":"Side French Toast with whipped butter, powdered sugar and cinnamon.","thumbnail":"https://framerusercontent.com/images/RJAfEydLUwG0mEBYlZxyC1qAOBI.png","sodium":350,"fiber":1,"sugars":3,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Nul_qUXUQ","title":"Grits of the Day","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Sides","price":3.99,"ingredients":"Chef's daily grits preparation.","shortIngr":"Chef's daily grits preparation.","description":"Chef's daily grits preparation.","thumbnail":"https://framerusercontent.com/images/7tDrNquzD80oDPKK1u8T4NCgX4.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"lk2rMGDNt","title":"Applewood Bacon","calories":320,"protein":20,"carbs":0,"fat":28,"category":"Sides","price":5.99,"ingredients":"(4) slices of Applewood Bacon.","shortIngr":"(4) slices of Applewood Bacon.","description":"(4) slices of Applewood Bacon.","thumbnail":"https://framerusercontent.com/images/clJeEEhkKaEqU84R9Lc1uHkw88.jpg","sodium":60,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"wwwR6B7St","title":"Turkey Sausage","calories":270,"protein":21,"carbs":0,"fat":21,"category":"Sides","price":4.99,"ingredients":"Three turkey sausage patties.","shortIngr":"Three turkey sausage patties.","description":"Three turkey sausage patties.","thumbnail":"https://framerusercontent.com/images/wgpIMxKxm4tw24KbGvtp4i0QTQ.png","sodium":910,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"hem3FTz0X","title":"Sausage Links","calories":460,"protein":14,"carbs":1,"fat":45,"category":"Sides","price":4.99,"ingredients":"Four seasoned pork sausage links.","shortIngr":"Four seasoned pork sausage links.","description":"Four seasoned pork sausage links.","thumbnail":"https://framerusercontent.com/images/Dsrw9kgMGahSJM8YB0iHBJKTM.png","sodium":570,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"dfZTwm6D4","title":"Canadian Bacon","calories":90,"protein":15,"carbs":3,"fat":2,"category":"Sides","price":4.99,"ingredients":"Four slices of Canadian bacon.","shortIngr":"Four slices of Canadian bacon.","description":"Four slices of Canadian bacon.","thumbnail":"https://framerusercontent.com/images/eCkBzxetnHIagtpvJu9b2amiE.png","sodium":1040,"fiber":0,"sugars":3,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"b2FMVjS0v","title":"Breakfast Tots","calories":440,"protein":8,"carbs":21,"fat":34,"category":"Breakfast Mains","price":4.99,"ingredients":"Crispy house-made hash brown potatoes baked with sour cream diced onions, spices, and cheddar jack cheese.","shortIngr":"Crispy house-made hash brown potatoes baked with sour cream ","description":"Crispy house-made hash brown potatoes baked with sour cream diced onions, spices, and cheddar jack cheese.","thumbnail":"https://framerusercontent.com/images/rPeuQrn2lIx145vk0QQsP331A.png","sodium":960,"fiber":0,"sugars":3,"allergens":["milk","soy"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"z_dRfSd4j","title":"Fresh Fruit","calories":110,"protein":2,"carbs":28,"fat":0,"category":"Sides","price":4.99,"ingredients":"Seasonal fresh fruit.","shortIngr":"Seasonal fresh fruit.","description":"Seasonal fresh fruit.","thumbnail":"https://framerusercontent.com/images/harva6NahRew5aipuNvizZMDxI.png","sodium":15,"fiber":3,"sugars":23,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"YhXLZiAHI","title":"Hashbrown Casserole","calories":440,"protein":9,"carbs":21,"fat":34,"category":"Sides","price":4.99,"ingredients":"Crispy house-made hash brown potatoes baked with sour cream, diced onions, spices and cheddar jack cheese.","shortIngr":"Crispy house-made hash brown potatoes baked with sour cream,","description":"Crispy house-made hash brown potatoes baked with sour cream, diced onions, spices and cheddar jack cheese.","thumbnail":"https://framerusercontent.com/images/tB1nhAprKhwpevead7MlfSRXHno.png","sodium":960,"fiber":0,"sugars":3,"allergens":["milk","soy"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ALhbeVcXq","title":"Side Salad","calories":160,"protein":10,"carbs":12,"fat":10,"category":"Sides","price":4.99,"ingredients":"Fresh mixed greens with your choice of dressing.","shortIngr":"Fresh mixed greens with your choice of dressing.","description":"Fresh mixed greens with your choice of dressing.","thumbnail":"https://framerusercontent.com/images/FYq7L0DmHkbyuYZwQTkZVyORqeY.png","sodium":190,"fiber":5,"sugars":5,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"D_rdSYyBY","title":"100% Orange Juice","calories":130,"protein":2,"carbs":29,"fat":0,"category":"Drinks & Cocktails","price":4.99,"ingredients":"Fresh squeezed. Available in small or large.","shortIngr":"Fresh squeezed. Available in small or large.","description":"Fresh squeezed. Available in small or large.","thumbnail":"https://framerusercontent.com/images/mfUS3kOnPRWeE0FdbPTerLPn5M.png","sodium":0,"fiber":0,"sugars":23,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"NTp2p5AwS","title":"Wild Juices","calories":160,"protein":0,"carbs":38,"fat":0,"category":"Drinks & Cocktails","price":3.99,"ingredients":"Cranberry or Grapefruit: Small $4.99 / Large $6.99. Apple or V8: Small $3.99 / Large $5.99.","shortIngr":"Cranberry or Grapefruit: Small $4.99 / Large $6.99. Apple or","description":"Cranberry or Grapefruit: Small $4.99 / Large $6.99. Apple or V8: Small $3.99 / Large $5.99.","thumbnail":"https://framerusercontent.com/images/gfzg9wBNpI6se40hh9ypWRUTc.jpg","sodium":35,"fiber":0,"sugars":38,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"P3xGbmiYB","title":"Milk or Chocolate Milk","calories":170,"protein":9,"carbs":13,"fat":9,"category":"Drinks & Cocktails","price":3.99,"ingredients":"Cold milk or chocolate milk. Available in small or large.","shortIngr":"Cold milk or chocolate milk. Available in small or large.","description":"Cold milk or chocolate milk. Available in small or large.","thumbnail":"https://framerusercontent.com/images/RSA3Y6bDK6B5jccjofBw2vMqB9s.png","sodium":120,"fiber":0,"sugars":14,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"IvxCsJxlJ","title":"House Lemonade","calories":150,"protein":0,"carbs":40,"fat":0,"category":"Drinks & Cocktails","price":3.99,"ingredients":"House lemonade, regular or strawberry.","shortIngr":"House lemonade, regular or strawberry.","description":"House lemonade, regular or strawberry.","thumbnail":"https://framerusercontent.com/images/Jl8FGa8En7YOUgqY6hooyuEYS8.png","sodium":5,"fiber":0,"sugars":36,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"TuO4W30hL","title":"Coca-Cola Products","calories":120,"protein":0,"carbs":34,"fat":0,"category":"Drinks & Cocktails","price":3.49,"ingredients":"We proudly serve Coca-Cola products. Free refills.","shortIngr":"We proudly serve Coca-Cola products. Free refills.","description":"We proudly serve Coca-Cola products. Free refills.","thumbnail":"https://framerusercontent.com/images/FOx5t6lsdz3sAyqpC669qOu57tY.png","sodium":40,"fiber":0,"sugars":34,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"nIZ_VfJKt","title":"Coffee","calories":25,"protein":2,"carbs":0,"fat":2,"category":"Drinks & Cocktails","price":3.49,"ingredients":"Regular or decaf. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Regular or decaf. Add a flavor for $0.99: hazelnut, vanilla ","description":"Regular or decaf. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/0izGiUXFI3Qm3ilCQv4Sp7Utf0Q.png","sodium":35,"fiber":0,"sugars":0,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"IB9c1Lqai","title":"Hot or Iced Tea","calories":5,"protein":0,"carbs":3,"fat":0,"category":"Drinks & Cocktails","price":3.49,"ingredients":"Hot or iced tea, regular or decaf. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Hot or iced tea, regular or decaf. Add a flavor for $0.99: h","description":"Hot or iced tea, regular or decaf. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/d6MtodXI7V4iGVPNURXotTgcC4.png","sodium":10,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"KScRPlhDr","title":"Sweet Tea","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":3.49,"ingredients":"Southern-style sweet iced tea. Free refills.","shortIngr":"Southern-style sweet iced tea. Free refills.","description":"Southern-style sweet iced tea. Free refills.","thumbnail":"https://framerusercontent.com/images/TAn99dfA26k9dxvXy51QdC37CNQ.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"UydTYkMn9","title":"Hot Chocolate","calories":490,"protein":11,"carbs":98,"fat":9,"category":"Drinks & Cocktails","price":3.99,"ingredients":"Rich hot chocolate.","shortIngr":"Rich hot chocolate.","description":"Rich hot chocolate.","thumbnail":"https://framerusercontent.com/images/6H9j32oN5GLWscgGnTVT8Mp53Y.png","sodium":150,"fiber":4,"sugars":80,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ckRcK3uKP","title":"Americano","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":4.99,"ingredients":"Espresso shots with hot water. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Espresso shots with hot water. Add a flavor for $0.99: hazel","description":"Espresso shots with hot water. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/r3NhoKCH6qvrX2ngdQB68rjTzU.png","sodium":15,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"gxS4C7qM_","title":"Red Eye","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":6.49,"ingredients":"Coffee with a shot of espresso. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Coffee with a shot of espresso. Add a flavor for $0.99: haze","description":"Coffee with a shot of espresso. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/0izGiUXFI3Qm3ilCQv4Sp7Utf0Q.png","sodium":15,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"QHOtZ1wFL","title":"Espresso","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":4.99,"ingredients":"Single or double shot of espresso. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Single or double shot of espresso. Add a flavor for $0.99: h","description":"Single or double shot of espresso. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/jayahqMWBStpeAhJivxrGnwMpxo.png","sodium":10,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"VCuyHv1AP","title":"Cold Brew","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":6.49,"ingredients":"Slow-steeped cold brew coffee. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Slow-steeped cold brew coffee. Add a flavor for $0.99: hazel","description":"Slow-steeped cold brew coffee. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/x4KFPUzTFz3p3OgZJpqH9UbFlQ.png","sodium":5,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"wcfjJNwSG","title":"Café Mocha","calories":370,"protein":10,"carbs":60,"fat":10,"category":"Drinks & Cocktails","price":6.49,"ingredients":"Espresso, steamed milk and chocolate. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Espresso, steamed milk and chocolate. Add a flavor for $0.99","description":"Espresso, steamed milk and chocolate. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":140,"fiber":4,"sugars":57,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Ed2pG3e5r","title":"Cappuccino","calories":150,"protein":8,"carbs":12,"fat":8,"category":"Drinks & Cocktails","price":6.49,"ingredients":"Espresso with equal parts steamed and foamed milk. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Espresso with equal parts steamed and foamed milk. Add a fla","description":"Espresso with equal parts steamed and foamed milk. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":115,"fiber":0,"sugars":13,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"CF4gnsx9n","title":"Latte","calories":150,"protein":8,"carbs":12,"fat":8,"category":"Drinks & Cocktails","price":6.49,"ingredients":"Espresso with steamed milk. Add a flavor for $0.99: hazelnut, vanilla or caramel.","shortIngr":"Espresso with steamed milk. Add a flavor for $0.99: hazelnut","description":"Espresso with steamed milk. Add a flavor for $0.99: hazelnut, vanilla or caramel.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":115,"fiber":0,"sugars":13,"allergens":["milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"JF5vwQ_vR","title":"Mimosa","calories":110,"protein":1,"carbs":8,"fat":0,"category":"Drinks & Cocktails","price":6.99,"ingredients":"Sparkling wine and 100% fresh squeezed orange juice.","shortIngr":"Sparkling wine and 100% fresh squeezed orange juice.","description":"Sparkling wine and 100% fresh squeezed orange juice.","thumbnail":"https://framerusercontent.com/images/fypxniSCVBBJtXhPOb6POpPuQ.jpg","sodium":0,"fiber":0,"sugars":7,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"dgsZMQWiE","title":"Pomegranate Mimosa","calories":180,"protein":1,"carbs":33,"fat":0,"category":"Drinks & Cocktails","price":7.99,"ingredients":"Sparkling wine and pomegranate juice.","shortIngr":"Sparkling wine and pomegranate juice.","description":"Sparkling wine and pomegranate juice.","thumbnail":"https://framerusercontent.com/images/Oe3XtNX2OhXAKdujPmxW1pd1oo.jpg","sodium":10,"fiber":0,"sugars":30,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"XmePaMeEl","title":"Strawberry Lemonade Mimosa","calories":150,"protein":0,"carbs":7,"fat":0,"category":"Drinks & Cocktails","price":7.99,"ingredients":"Sparkling wine and strawberry lemonade.","shortIngr":"Sparkling wine and strawberry lemonade.","description":"Sparkling wine and strawberry lemonade.","thumbnail":"https://framerusercontent.com/images/eY0gKEENZHWRkjzM5DYKlTY14.png","sodium":0,"fiber":0,"sugars":6,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"OqNjwZRj7","title":"Orange Pineapple Mimosa","calories":170,"protein":1,"carbs":11,"fat":0,"category":"Drinks & Cocktails","price":7.99,"ingredients":"Sparkling wine with orange juice and pineapple juice.","shortIngr":"Sparkling wine with orange juice and pineapple juice.","description":"Sparkling wine with orange juice and pineapple juice.","thumbnail":"https://framerusercontent.com/images/Oe3XtNX2OhXAKdujPmxW1pd1oo.jpg","sodium":0,"fiber":0,"sugars":9,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"colvHtZLI","title":"Gran Mimosa","calories":180,"protein":1,"carbs":17,"fat":0,"category":"Drinks & Cocktails","price":8.99,"ingredients":"Sparkling wine, Gran Gala, and 100% fresh squeezed orange juice.","shortIngr":"Sparkling wine, Gran Gala, and 100% fresh squeezed orange ju","description":"Sparkling wine, Gran Gala, and 100% fresh squeezed orange juice.","thumbnail":"https://framerusercontent.com/images/Oe3XtNX2OhXAKdujPmxW1pd1oo.jpg","sodium":0,"fiber":0,"sugars":15,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"NxjhNIMWs","title":"Wild Screwdriver","calories":190,"protein":1,"carbs":22,"fat":0,"category":"Drinks & Cocktails","price":9.99,"ingredients":"Vodka and 100% fresh squeezed orange juice.","shortIngr":"Vodka and 100% fresh squeezed orange juice.","description":"Vodka and 100% fresh squeezed orange juice.","thumbnail":"https://framerusercontent.com/images/DHR7gdjbzJFP1at8rBLoWvuY.png","sodium":0,"fiber":0,"sugars":18,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ldJqOeOv3","title":"Proud Mary","calories":180,"protein":2,"carbs":11,"fat":2,"category":"Drinks & Cocktails","price":10.99,"ingredients":"Award-winning. Vodka mixed with our house Bloody Mary recipe.","shortIngr":"Award-winning. Vodka mixed with our house Bloody Mary recipe","description":"Award-winning. Vodka mixed with our house Bloody Mary recipe.","thumbnail":"https://framerusercontent.com/images/ha67DqMDvU2qQvJmUnmUInzhhw4.jpg","sodium":2840,"fiber":3,"sugars":5,"allergens":["soy"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"z3xgd8CAU","title":"Tequila Sunrise","calories":280,"protein":1,"carbs":31,"fat":0,"category":"Drinks & Cocktails","price":9.99,"ingredients":"Tequila, grenadine, and 100% fresh squeezed orange juice.","shortIngr":"Tequila, grenadine, and 100% fresh squeezed orange juice.","description":"Tequila, grenadine, and 100% fresh squeezed orange juice.","thumbnail":"https://framerusercontent.com/images/ha67DqMDvU2qQvJmUnmUInzhhw4.jpg","sodium":0,"fiber":0,"sugars":27,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Gn99lKSFN","title":"Bluegrass Sunrise","calories":210,"protein":0,"carbs":30,"fat":0,"category":"Drinks & Cocktails","price":9.99,"ingredients":"Bourbon with cranberry juice and our homemade lemonade.","shortIngr":"Bourbon with cranberry juice and our homemade lemonade.","description":"Bourbon with cranberry juice and our homemade lemonade.","thumbnail":"https://framerusercontent.com/images/AnqRLWgLKxA5FSpfoT0v9vcapz4.jpg","sodium":15,"fiber":0,"sugars":27,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"b9ktsrPed","title":"Iced Vanilla Latte","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":8.99,"ingredients":"Cold brew with vanilla, coffee liqueur, and Wheatley vodka, served on ice.","shortIngr":"Cold brew with vanilla, coffee liqueur, and Wheatley vodka, ","description":"Cold brew with vanilla, coffee liqueur, and Wheatley vodka, served on ice.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"zaf0wys6r","title":"Chocolate Kiss","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":6.99,"ingredients":"Hot coffee with coffee liqueur, Ryan's Irish Cream, and crème de cocoa, topped with whipped cream.","shortIngr":"Hot coffee with coffee liqueur, Ryan's Irish Cream, and crèm","description":"Hot coffee with coffee liqueur, Ryan's Irish Cream, and crème de cocoa, topped with whipped cream.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"hSLyWNxsY","title":"Nutty Irishman","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":7.99,"ingredients":"Hot coffee, hazelnut liqueur, and Ryan's Irish Cream, topped with whipped cream.","shortIngr":"Hot coffee, hazelnut liqueur, and Ryan's Irish Cream, topped","description":"Hot coffee, hazelnut liqueur, and Ryan's Irish Cream, topped with whipped cream.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Rmf7XV32f","title":"Choc of the Morning","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":8.99,"ingredients":"Cold brew with Ryan's Irish Cream, crème de cocoa, chocolate, vanilla, and Wheatley vodka.","shortIngr":"Cold brew with Ryan's Irish Cream, crème de cocoa, chocolate","description":"Cold brew with Ryan's Irish Cream, crème de cocoa, chocolate, vanilla, and Wheatley vodka.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"AjWNalDaW","title":"Bacon City","calories":0,"protein":63,"carbs":7,"fat":86,"category":"Breakfast Mains","price":16.99,"ingredients":"Bacon and cheddar jack cheese topped with our house-made white cheddar mornay. Served with a fresh-baked Everything or Blueberry Muffin and your choice of skillet potatoes, stone-ground grits, or grits of the day.","shortIngr":"Bacon and cheddar jack cheese topped with our house-made whi","description":"Bacon and cheddar jack cheese topped with our house-made white cheddar mornay. Served with a fresh-baked Everything or Blueberry Muffin and your choice of skillet potatoes, stone-ground grits, or grits of the day.","thumbnail":"https://framerusercontent.com/images/KkbPPw1AVNRW0n4MFIrXg68.jpg","sodium":1880,"fiber":0,"sugars":0,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"P_SwuFl6e","title":"Totchos Skillet","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Breakfast Mains","price":13.49,"ingredients":"Crispy house-made tots smothered in white bacon gravy, layered with two scrambled eggs, melted cheddar cheese, sautéed peppers and onions, and finished with pickled jalapeños and green onions.","shortIngr":"Crispy house-made tots smothered in white bacon gravy, layer","description":"Crispy house-made tots smothered in white bacon gravy, layered with two scrambled eggs, melted cheddar cheese, sautéed peppers and onions, and finished with pickled jalapeños and green onions.","thumbnail":"https://framerusercontent.com/images/6n9pXxrkJl1ZwdIvK1QdE6vOgg.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: eggs, dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"ZGZmv_izy","title":"Loco Hash","calories":1090,"protein":49,"carbs":48,"fat":80,"category":"Breakfast Mains","price":14.99,"ingredients":"Skillet potatoes topped with crispy carnitas, queso, sautéed onions, bell peppers and jalapeños. Served with 2 eggs your way and topped with sour cream, avocado, pico de gallo and green onions.","shortIngr":"Skillet potatoes topped with crispy carnitas, queso, sautéed","description":"Skillet potatoes topped with crispy carnitas, queso, sautéed onions, bell peppers and jalapeños. Served with 2 eggs your way and topped with sour cream, avocado, pico de gallo and green onions.","thumbnail":"https://framerusercontent.com/images/hyXrbqviIrNojBN79W6eoYJvt1c.jpeg","sodium":2450,"fiber":8,"sugars":7,"allergens":["egg","milk"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"WX4uz6wYY","title":"Corned Beef Hash Bennie","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Bonnie's Bennies","price":13.99,"ingredients":"Ironed hash-brown casserole, seasoned lean corned beef, sautéed onions and bell peppers. Topped with poached eggs and housemade Thousand Island Hollandaise sauce. Served with your choice of side.","shortIngr":"Ironed hash-brown casserole, seasoned lean corned beef, saut","description":"Ironed hash-brown casserole, seasoned lean corned beef, sautéed onions and bell peppers. Topped with poached eggs and housemade Thousand Island Hollandaise sauce. Served with your choice of side.","thumbnail":"https://framerusercontent.com/images/MAEgq9LhEwI58JubZ7NtqCQdB6c.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: eggs, dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"DYRjepxD3","title":"California Bennie","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Bonnie's Bennies","price":13.99,"ingredients":"Grilled English muffin, avocado, smoked turkey, and grilled tomato, topped with poached eggs, fresh hollandaise, chopped bacon and smoked paprika. Served with your choice of side.","shortIngr":"Grilled English muffin, avocado, smoked turkey, and grilled ","description":"Grilled English muffin, avocado, smoked turkey, and grilled tomato, topped with poached eggs, fresh hollandaise, chopped bacon and smoked paprika. Served with your choice of side.","thumbnail":"https://framerusercontent.com/images/Crg3ZSFb4gSfsI4Oz4pVe8QfdoI.jpeg","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: eggs, dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"gbZbd483Z","title":"Chocolate Hazelnut Stuffed French Toast","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Pancakes, Waffles & Sweets","price":13.49,"ingredients":"Thick-sliced sourdough filled with chocolate hazelnut and honey sweetened cream cheese, topped with fresh strawberries, powdered sugar, whipped cream, and a drizzle of NUTELLA®. Substitute gluten-free bread at no charge.","shortIngr":"Thick-sliced sourdough filled with chocolate hazelnut and ho","description":"Thick-sliced sourdough filled with chocolate hazelnut and honey sweetened cream cheese, topped with fresh strawberries, powdered sugar, whipped cream, and a drizzle of NUTELLA®. Substitute gluten-free bread at no charge.","thumbnail":"https://framerusercontent.com/images/Gru8djzTx7E3IAnwUhm8Hcapg.png","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","tree_nuts","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"d5Pf7flsE","title":"Laredo Steak & Cheese Sandwich","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Lunch & Sandwiches","price":14.99,"ingredients":"Thinly sliced steak smothered in pepper jack cheese with sautéed peppers and onions on grilled sourdough bread with chipotle mayonnaise and Habagardil pickle. Served with your choice of french fries or skillet potatoes. Substitute gluten-free bread at no charge.","shortIngr":"Thinly sliced steak smothered in pepper jack cheese with sau","description":"Thinly sliced steak smothered in pepper jack cheese with sautéed peppers and onions on grilled sourdough bread with chipotle mayonnaise and Habagardil pickle. Served with your choice of french fries or skillet potatoes. Substitute gluten-free bread at no charge.","thumbnail":"https://framerusercontent.com/images/8pHv78hvi7dmozUa55uLYJafFSk.jpeg","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"TBC4OpC5D","title":"Reuben","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Lunch & Sandwiches","price":15.99,"ingredients":"Piled lean corned beef, Swiss cheese, sauerkraut, toasted light rye and our homemade Thousand Island dressing. Served with your choice of french fries or skillet potatoes.","shortIngr":"Piled lean corned beef, Swiss cheese, sauerkraut, toasted li","description":"Piled lean corned beef, Swiss cheese, sauerkraut, toasted light rye and our homemade Thousand Island dressing. Served with your choice of french fries or skillet potatoes.","thumbnail":"https://framerusercontent.com/images/cLBp57aIrefAA2rZNnNHdVlzkaw.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"AwB74e1HM","title":"Taco Salad","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Lunch & Sandwiches","price":12.99,"ingredients":"Crispy flour tortilla filled with lettuce tossed in cilantro lime vinaigrette with onion, roasted corn, black beans, pico de gallo, cheddar jack cheese, avocado mash, and sour cream. Your choice of taco beef or spiced pulled chicken.","shortIngr":"Crispy flour tortilla filled with lettuce tossed in cilantro","description":"Crispy flour tortilla filled with lettuce tossed in cilantro lime vinaigrette with onion, roasted corn, black beans, pico de gallo, cheddar jack cheese, avocado mash, and sour cream. Your choice of taco beef or spiced pulled chicken.","thumbnail":"https://framerusercontent.com/images/xU9bUx0qFFNFF3wJ658wT0F5kP0.png","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"n4Z3vi198","title":"Undertow","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":4.99,"ingredients":"Half & half, vanilla, and a shot of espresso.","shortIngr":"Half & half, vanilla, and a shot of espresso.","description":"Half & half, vanilla, and a shot of espresso.","thumbnail":"https://framerusercontent.com/images/0bUvzIINZkiknPCGuESpHeHjJ1k.png","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: dairy"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Ha4IVfLXj","title":"Biscuit","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Sides","price":1.99,"ingredients":"House-made buttermilk biscuit.","shortIngr":"House-made buttermilk biscuit.","description":"House-made buttermilk biscuit.","thumbnail":"https://framerusercontent.com/images/wpNePRvjeSETYjhcqoADEPs6T3E.png","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: dairy, gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"BLVJ6WmFl","title":"Toast","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Sides","price":1.99,"ingredients":"Two slices of your choice of bread.","shortIngr":"Two slices of your choice of bread.","description":"Two slices of your choice of bread.","thumbnail":"https://framerusercontent.com/images/W7eEDVkRByKFBNd6NjciWywH7k.png","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: gluten"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"OILNj18lU","title":"Blueberry Muffin","calories":350,"protein":3,"carbs":60,"fat":10,"category":"Sides","price":2.49,"ingredients":"Fresh-baked blueberry muffin.","shortIngr":"Fresh-baked blueberry muffin.","description":"Fresh-baked blueberry muffin.","thumbnail":"https://framerusercontent.com/images/3SEarclTP8dJw3rKmIj7GN57fw.png","sodium":660,"fiber":0,"sugars":36,"allergens":["egg","milk","soy","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"EEatetiCE","title":"Everything Muffin","calories":430,"protein":7,"carbs":48,"fat":22,"category":"Sides","price":2.49,"ingredients":"Fresh-baked everything muffin.","shortIngr":"Fresh-baked everything muffin.","description":"Fresh-baked everything muffin.","thumbnail":"https://framerusercontent.com/images/UZtooq9IbVmIySj5Mit1yqIp1yo.png","sodium":920,"fiber":2,"sugars":13,"allergens":["egg","milk","sesame","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"OMGxHDjKi","title":"Eggs","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Sides","price":2.99,"ingredients":"Two eggs cooked any style.","shortIngr":"Two eggs cooked any style.","description":"Two eggs cooked any style.","thumbnail":"https://framerusercontent.com/images/YYPn60hs5xhna9yMLdaNxNYIS8.png","sodium":0,"fiber":0,"sugars":0,"allergens":["allergens: eggs"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"csnguSAJ3","title":"Kids Pancakes","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":5.99,"ingredients":"Two short-stack pancakes topped with whipped cream and powdered sugar, served with a small drink. Add fresh strawberries, blueberries, candied pecans, chocolate chips, or chopped bacon for $1.49 each. Gluten-friendly option available upon request at no extra charge.","shortIngr":"Two short-stack pancakes topped with whipped cream and powde","description":"Two short-stack pancakes topped with whipped cream and powdered sugar, served with a small drink. Add fresh strawberries, blueberries, candied pecans, chocolate chips, or chopped bacon for $1.49 each. Gluten-friendly option available upon request at no extra charge.","thumbnail":"https://framerusercontent.com/images/xDXh6Jm8ZwputrOXoxWa4sjcwI.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"YM0quIlbj","title":"Lil' French Toast","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":5.99,"ingredients":"Two slices of Texas toast dipped in brandied egg batter, topped with whipped cream and powdered sugar, served with a small drink (no refills). Gluten-friendly option available upon request at no extra charge.","shortIngr":"Two slices of Texas toast dipped in brandied egg batter, top","description":"Two slices of Texas toast dipped in brandied egg batter, topped with whipped cream and powdered sugar, served with a small drink (no refills). Gluten-friendly option available upon request at no extra charge.","thumbnail":"https://framerusercontent.com/images/1cN69du1GOsHh9BMNoigxNUBYs.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"soUXm8s9M","title":"Cheesy Quesadilla","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":5.99,"ingredients":"Melted Monterrey jack and cheddar cheese quesadilla served with a small drink and your choice of side: fresh fruit, sautéed vegetables, french fries, or home fries. Add chicken, bacon, or breakfast sausage for $1.99. Gluten-friendly option available upon request at no extra charge.","shortIngr":"Melted Monterrey jack and cheddar cheese quesadilla served w","description":"Melted Monterrey jack and cheddar cheese quesadilla served with a small drink and your choice of side: fresh fruit, sautéed vegetables, french fries, or home fries. Add chicken, bacon, or breakfast sausage for $1.99. Gluten-friendly option available upon request at no extra charge.","thumbnail":"https://framerusercontent.com/images/XDPkgIfrDNCF6M2d9o3TvdczwU.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"B8NDpf_fC","title":"Bacon, Egg & Cheese Sammie","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":5.99,"ingredients":"Bacon, two scrambled eggs, and cheese on a golden bun, served with a small drink and your choice of side: fresh fruit, sautéed vegetables, french fries, or home fries. Gluten-friendly option available upon request at no extra charge.","shortIngr":"Bacon, two scrambled eggs, and cheese on a golden bun, serve","description":"Bacon, two scrambled eggs, and cheese on a golden bun, served with a small drink and your choice of side: fresh fruit, sautéed vegetables, french fries, or home fries. Gluten-friendly option available upon request at no extra charge.","thumbnail":"https://framerusercontent.com/images/XDPkgIfrDNCF6M2d9o3TvdczwU.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"XYpSJI9U5","title":"Lil' Breakfast Plate","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":5.99,"ingredients":"Two eggs your way, two pieces of bacon or sausage, toast, and your choice of side, served with a small drink. Add cheese to your eggs for $0.99. Gluten-friendly option available upon request at no extra charge.","shortIngr":"Two eggs your way, two pieces of bacon or sausage, toast, an","description":"Two eggs your way, two pieces of bacon or sausage, toast, and your choice of side, served with a small drink. Add cheese to your eggs for $0.99. Gluten-friendly option available upon request at no extra charge.","thumbnail":"https://framerusercontent.com/images/mWLTmXECE58nMTm3Yz2xue2gGKw.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"fgwF2zWvo","title":"Kid's Burger","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":5.99,"ingredients":"Choice of hamburger or cheeseburger served with a small drink and your choice of side: fresh fruit, sautéed vegetables, french fries, or home fries. Add two slices of bacon for $1.99. Gluten-friendly option available upon request at no extra charge.","shortIngr":"Choice of hamburger or cheeseburger served with a small drin","description":"Choice of hamburger or cheeseburger served with a small drink and your choice of side: fresh fruit, sautéed vegetables, french fries, or home fries. Add two slices of bacon for $1.99. Gluten-friendly option available upon request at no extra charge.","thumbnail":"https://framerusercontent.com/images/749TrBXeWso8BnMgwgCQGbIQzHI.png","sodium":0,"fiber":0,"sugars":0,"allergens":["milk","wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"rrXoKPN1e","title":"One Egg","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":1.49,"ingredients":"One egg cooked any style.","shortIngr":"One egg cooked any style.","description":"One egg cooked any style.","thumbnail":"https://framerusercontent.com/images/YYPn60hs5xhna9yMLdaNxNYIS8.png","sodium":0,"fiber":0,"sugars":0,"allergens":["egg"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"lepwKpMdm","title":"Two Eggs","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":2.99,"ingredients":"Two eggs cooked any style.","shortIngr":"Two eggs cooked any style.","description":"Two eggs cooked any style.","thumbnail":"https://framerusercontent.com/images/YYPn60hs5xhna9yMLdaNxNYIS8.png","sodium":0,"fiber":0,"sugars":0,"allergens":["egg"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"RjuEe8r9l","title":"Kid's Fruit","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":2.49,"ingredients":"Seasonal fresh fruit.","shortIngr":"Seasonal fresh fruit.","description":"Seasonal fresh fruit.","thumbnail":"https://framerusercontent.com/images/harva6NahRew5aipuNvizZMDxI.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"E9HbR9FhT","title":"Kid's Home Fries","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":1.79,"ingredients":"Kids portion of skillet potatoes.","shortIngr":"Kids portion of skillet potatoes.","description":"Kids portion of skillet potatoes.","thumbnail":"https://framerusercontent.com/images/XFKORvUAGmnbRmITHTfZrX0wUnI.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"EPgIcIP71","title":"Two Strips of Bacon","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":1.99,"ingredients":"Two strips of applewood bacon.","shortIngr":"Two strips of applewood bacon.","description":"Two strips of applewood bacon.","thumbnail":"https://framerusercontent.com/images/Fhs9qvgE8CBB8fMvIryzG6Yw.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"IUg0REM5G","title":"Two Sausage Links","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":1.99,"ingredients":"Two seasoned pork sausage links.","shortIngr":"Two seasoned pork sausage links.","description":"Two seasoned pork sausage links.","thumbnail":"https://framerusercontent.com/images/Dsrw9kgMGahSJM8YB0iHBJKTM.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"PG7UrpSae","title":"Two Turkey Sausage Patties","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":1.99,"ingredients":"Two turkey sausage patties.","shortIngr":"Two turkey sausage patties.","description":"Two turkey sausage patties.","thumbnail":"https://framerusercontent.com/images/wgpIMxKxm4tw24KbGvtp4i0QTQ.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"mcSMNYTii","title":"Kids Toast","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":0.99,"ingredients":"Your choice of regular or gluten-free toast.","shortIngr":"Your choice of regular or gluten-free toast.","description":"Your choice of regular or gluten-free toast.","thumbnail":"https://framerusercontent.com/images/XDPkgIfrDNCF6M2d9o3TvdczwU.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["wheat"],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"KpBfHzSo_","title":"Kids Fresh Squeezed OJ","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Kids Menu","price":2.49,"ingredients":"100% fresh squeezed orange juice, kids size (no refills). Warning: this product has not been pasteurized and may contain harmful bacteria.","shortIngr":"100% fresh squeezed orange juice, kids size (no refills). Wa","description":"100% fresh squeezed orange juice, kids size (no refills). Warning: this product has not been pasteurized and may contain harmful bacteria.","thumbnail":"https://framerusercontent.com/images/06Z9b6KQVtMGq0V4umu8Qitw.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"PMgaf76KK","title":"Peach Mimosa","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Drinks & Cocktails","price":7.99,"ingredients":"Sparkling wine and peach juice.","shortIngr":"Sparkling wine and peach juice.","description":"Sparkling wine and peach juice.","thumbnail":"https://framerusercontent.com/images/8ab5TOr7mCqy7Ha9fncbWGagw.png","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://order.toasttab.com/online/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d/default"},{"id":"Zms_MVRgo","title":"Breakfast Meats","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":31.0,"ingredients":"Your choice of one breakfast meat: bacon (20 pieces), sausage (40 links), turkey sausage (20 patties), ham (20 slices), or Canadian bacon (30 slices).","shortIngr":"Your choice of one breakfast meat: bacon (20 pieces), sausag","description":"Your choice of one breakfast meat: bacon (20 pieces), sausage (40 links), turkey sausage (20 patties), ham (20 slices), or Canadian bacon (30 slices).","thumbnail":"https://framerusercontent.com/images/cXs2hLFOYcaqLa03ocaz70EMDVs.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"u5TPSAkPq","title":"Scrambled Eggs","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":25.0,"ingredients":"Fluffy scrambled eggs made fresh to order.","shortIngr":"Fluffy scrambled eggs made fresh to order.","description":"Fluffy scrambled eggs made fresh to order.","thumbnail":"https://framerusercontent.com/images/G1baQMNeZDR174wMjdYOsGY.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"drEHd9tS8","title":"Pancakes","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":39.0,"ingredients":"Fluffy buttermilk pancakes with whipped butter, powdered sugar, and pancake syrup. Order them gluten-free for $47.","shortIngr":"Fluffy buttermilk pancakes with whipped butter, powdered sug","description":"Fluffy buttermilk pancakes with whipped butter, powdered sugar, and pancake syrup. Order them gluten-free for $47.","thumbnail":"https://framerusercontent.com/images/8XeFASdOPNoJgrJtHIbmFOy4.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"WzYwHuXVk","title":"Cinnamon Rolls","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":79.0,"ingredients":"Pastry dough filled with butter, brown sugar, and cinnamon, topped with vanilla bean cream cheese icing.","shortIngr":"Pastry dough filled with butter, brown sugar, and cinnamon, ","description":"Pastry dough filled with butter, brown sugar, and cinnamon, topped with vanilla bean cream cheese icing.","thumbnail":"https://framerusercontent.com/images/MhC4Av87U0Rkcax5QvjJBZl5U.png","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"bG1Zee2iF","title":"French Toast Casserole","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":79.0,"ingredients":"Sourdough bread tossed in brandied egg batter, topped with vanilla bean cream cheese icing, powdered sugar, and cinnamon.","shortIngr":"Sourdough bread tossed in brandied egg batter, topped with v","description":"Sourdough bread tossed in brandied egg batter, topped with vanilla bean cream cheese icing, powdered sugar, and cinnamon.","thumbnail":"https://framerusercontent.com/images/BLJjcV7gd9LMEN6cxLMCQSACjC0.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"JdOH_nUFD","title":"Hashbrown Casserole","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":45.0,"ingredients":"Shredded potatoes baked with sour cream, yellow Spanish onions, cheddar jack cheese, seasonings, and green onions.","shortIngr":"Shredded potatoes baked with sour cream, yellow Spanish onio","description":"Shredded potatoes baked with sour cream, yellow Spanish onions, cheddar jack cheese, seasonings, and green onions.","thumbnail":"https://framerusercontent.com/images/PSbrRFAk6pJds2NbIW3Dew5Ai8.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["milk"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"isPvgmlaU","title":"Dozen Biscuits","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":26.0,"ingredients":"One dozen flaky buttermilk biscuits.","shortIngr":"One dozen flaky buttermilk biscuits.","description":"One dozen flaky buttermilk biscuits.","thumbnail":"https://framerusercontent.com/images/wpNePRvjeSETYjhcqoADEPs6T3E.png","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"LCJLlHPH2","title":"Bacon or Chorizo Gravy","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":26.0,"ingredients":"House-made bacon or chorizo gravy. Pairs perfectly with the Dozen Biscuits.","shortIngr":"House-made bacon or chorizo gravy. Pairs perfectly with the ","description":"House-made bacon or chorizo gravy. Pairs perfectly with the Dozen Biscuits.","thumbnail":"https://framerusercontent.com/images/RveqSqLdre76MhyMI6XyCLWCMcU.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"RiEbz_dlx","title":"Home Fries","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":40.0,"ingredients":"Seasoned skillet potatoes.","shortIngr":"Seasoned skillet potatoes.","description":"Seasoned skillet potatoes.","thumbnail":"https://framerusercontent.com/images/NPKH6e2Iw4VadB23xbXR8TrPI4.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"JTm3SjaLy","title":"Dozen Blueberry Muffins","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":26.0,"ingredients":"One dozen fresh-baked blueberry muffins.","shortIngr":"One dozen fresh-baked blueberry muffins.","description":"One dozen fresh-baked blueberry muffins.","thumbnail":"https://framerusercontent.com/images/pT6eT1cy3v9nORxm2aUbU3hKBc.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"e0Wavoqhy","title":"Dozen Everything Muffins","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":26.0,"ingredients":"One dozen fresh-baked everything muffins.","shortIngr":"One dozen fresh-baked everything muffins.","description":"One dozen fresh-baked everything muffins.","thumbnail":"https://framerusercontent.com/images/lieNnPcG5KzdtR6wkl4xBgcu70.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat","sesame"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"Fy5_h_b4s","title":"Fresh Mixed Fruit","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":49.0,"ingredients":"Seasonal fresh mixed fruit.","shortIngr":"Seasonal fresh mixed fruit.","description":"Seasonal fresh mixed fruit.","thumbnail":"https://framerusercontent.com/images/5QhIQCHz4z3HfRn7cr9sPg81BI.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"Dwxicyn1l","title":"Breakfast Burritos","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":119.0,"ingredients":"Flour tortillas wrapped with scrambled eggs, chorizo, cheddar jack cheese, poblano pepper, onion, queso fundido, home fries, and black beans. Topped with sour cream, pico de gallo, avocado, and green onion.","shortIngr":"Flour tortillas wrapped with scrambled eggs, chorizo, chedda","description":"Flour tortillas wrapped with scrambled eggs, chorizo, cheddar jack cheese, poblano pepper, onion, queso fundido, home fries, and black beans. Topped with sour cream, pico de gallo, avocado, and green onion.","thumbnail":"https://framerusercontent.com/images/8yUoo5qSKJBNIITp5Qh5ujX5w.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"ExR69fCYA","title":"Mexico City Chilaquiles","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":99.0,"ingredients":"Mexican-style breakfast casserole with corn tortillas, refried beans, salsa verde, pepper jack cheese, and scrambled eggs. Add chicken or chorizo for $20.","shortIngr":"Mexican-style breakfast casserole with corn tortillas, refri","description":"Mexican-style breakfast casserole with corn tortillas, refried beans, salsa verde, pepper jack cheese, and scrambled eggs. Add chicken or chorizo for $20.","thumbnail":"https://framerusercontent.com/images/ZeW3d9HCjiPedV7Cocp3tANOLdk.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"XToR8DXQO","title":"Potato Head Casserole","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":99.0,"ingredients":"Hashbrown potatoes baked with sour cream, diced onion, spices, and cheddar jack cheese, topped with breakfast sausage, diced onions, tomatoes, poblano peppers, roasted mushrooms, queso fundido, and scrambled eggs.","shortIngr":"Hashbrown potatoes baked with sour cream, diced onion, spice","description":"Hashbrown potatoes baked with sour cream, diced onion, spices, and cheddar jack cheese, topped with breakfast sausage, diced onions, tomatoes, poblano peppers, roasted mushrooms, queso fundido, and scrambled eggs.","thumbnail":"https://framerusercontent.com/images/p3n431AYQNVhngyc4060bLo3Tg.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"tz4sfvo3h","title":"Biscuits and Gravy","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":49.0,"ingredients":"Ten flaky buttermilk biscuits topped with house-made bacon or chorizo gravy.","shortIngr":"Ten flaky buttermilk biscuits topped with house-made bacon o","description":"Ten flaky buttermilk biscuits topped with house-made bacon or chorizo gravy.","thumbnail":"https://framerusercontent.com/images/eX46IOdAfB0bwbOxBg5E08PjHY.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"k_m1C3Y2j","title":"Kalamity Katie's Casserole","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":99.0,"ingredients":"Green chili cheddar corn cakes topped with chorizo, queso fundido, pico de gallo, sour cream, green onion, avocado, and scrambled eggs.","shortIngr":"Green chili cheddar corn cakes topped with chorizo, queso fu","description":"Green chili cheddar corn cakes topped with chorizo, queso fundido, pico de gallo, sour cream, green onion, avocado, and scrambled eggs.","thumbnail":"https://framerusercontent.com/images/47dMBpJ73cwu0awxtQTTfJPq8.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"YH4zMOK_e","title":"Yellow Sub Wraps","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":129.0,"ingredients":"Scrambled eggs, American cheese, grilled shaved ham, applewood smoked bacon, mayo, lettuce, tomato, red onion, and Habagardil pickle wrapped in a flour tortilla.","shortIngr":"Scrambled eggs, American cheese, grilled shaved ham, applewo","description":"Scrambled eggs, American cheese, grilled shaved ham, applewood smoked bacon, mayo, lettuce, tomato, red onion, and Habagardil pickle wrapped in a flour tortilla.","thumbnail":"https://framerusercontent.com/images/IYqDL0QKlsHtz8WAWO6Ybsr8.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"xTAXIDete","title":"Club Wraps","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":129.0,"ingredients":"Smoked turkey, thin-sliced ham, applewood smoked bacon, shredded lettuce, sliced tomato, and chipotle mayo wrapped in a flour tortilla.","shortIngr":"Smoked turkey, thin-sliced ham, applewood smoked bacon, shre","description":"Smoked turkey, thin-sliced ham, applewood smoked bacon, shredded lettuce, sliced tomato, and chipotle mayo wrapped in a flour tortilla.","thumbnail":"https://framerusercontent.com/images/EIydCBgQT2ABHAdTo1YtADDrjE.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk","wheat"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"kECHrFP1Q","title":"Wild Chef Salad","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":129.0,"ingredients":"Smoked turkey, ham, cheddar jack cheese, mixed greens, fresh tomatoes, chipotle ranch, and hard-boiled eggs.","shortIngr":"Smoked turkey, ham, cheddar jack cheese, mixed greens, fresh","description":"Smoked turkey, ham, cheddar jack cheese, mixed greens, fresh tomatoes, chipotle ranch, and hard-boiled eggs.","thumbnail":"https://framerusercontent.com/images/DPBPda2dUokxg6nyiTryBB0Ouk.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":["egg","milk"],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"BiQmipu3R","title":"Coffee","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":29.0,"ingredients":"Regular or decaf coffee. 3/4 gallon.","shortIngr":"Regular or decaf coffee. 3/4 gallon.","description":"Regular or decaf coffee. 3/4 gallon.","thumbnail":"https://framerusercontent.com/images/v5eP1Fzx0gFuLMWAMWbpu462SYE.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"AXNi8ZHLW","title":"Orange Juice","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":36.0,"ingredients":"A gallon of 100% fresh squeezed orange juice.","shortIngr":"A gallon of 100% fresh squeezed orange juice.","description":"A gallon of 100% fresh squeezed orange juice.","thumbnail":"https://framerusercontent.com/images/gfzg9wBNpI6se40hh9ypWRUTc.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"n27GNfQZC","title":"Iced Tea","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":19.0,"ingredients":"A gallon of sweet or unsweet iced tea.","shortIngr":"A gallon of sweet or unsweet iced tea.","description":"A gallon of sweet or unsweet iced tea.","thumbnail":"https://framerusercontent.com/images/DzHJ23ymZ6ou7xfMcWP3IpOto4.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"},{"id":"MQ5Kcqqf9","title":"Lemonade","calories":0,"protein":0,"carbs":0,"fat":0,"category":"Catering","price":30.0,"ingredients":"A gallon of 100% fresh squeezed lemonade.","shortIngr":"A gallon of 100% fresh squeezed lemonade.","description":"A gallon of 100% fresh squeezed lemonade.","thumbnail":"https://framerusercontent.com/images/VSHSxBlhJvLi5E2KyzMUXwvMCgo.jpg","sodium":0,"fiber":0,"sugars":0,"allergens":[],"orderLink":"https://www.toasttab.com/catering/locations/d765bb3c-6953-4f4d-b5e1-817dd3a11c8d"}]

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
function filterByGoal(items: MenuItem[], g: GoalDef): MenuItem[] {
    let list = items
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
    cmsEndpoint = "",
    apiKey      = "",
    orderUrl    = "#",
    fontFamily  = "'Hedvig Letters Sans', 'Helvetica Neue', sans-serif",
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
    const effectiveItems   = hasRealPropItems ? items : (cmsItems.length > 0 ? cmsItems : DEFAULT_ITEMS)

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
    const handleGoalClick  = useCallback((id: string) => setGoal(id), [])

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
                    : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.teal}, ${C.green})` }} />}
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
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 6 }}>Portion size</div>
                            <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Portion size">
                                {PORTION_LABELS.map(p => <button key={p.val} onClick={() => setPortion(p.val)} aria-pressed={portion === p.val} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", border: `1.5px solid ${portion === p.val ? C.orangeDark : C.border}`, background: portion === p.val ? C.orangeLight : "transparent", color: portion === p.val ? C.orangeDark : C.inkSoft }}>{p.label}</button>)}
                            </div>
                        </div>
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Nutrition analysis coming soon</div>
                        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>This item is pending lab analysis. Ask our staff about ingredients and allergens{selAlt && selAlt.calories > 0 ? `, or check the ${selAlt.title.endsWith("Wrap") ? "Wrap" : "Bowl"} version above for a close estimate` : ""}.</div>
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
                                        {s.thumbnail && <img src={s.thumbnail} alt="" role="presentation" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title.replace(/ (Wrap|Bowl)$/, "")}</div>
                                        <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: s.calories > 0 ? "normal" : "italic" }}>{s.calories > 0 ? `${s.calories} cal · ${s.protein}g pro` : "nutrition coming soon"}</div>
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
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ingredient" aria-label="Search menu items" style={{ flex: 1, minWidth: 160, padding: "8px 13px", borderRadius: 8, border: `1.5px solid ${search ? C.orange : C.border}`, fontSize: 13, color: C.ink, background: C.inkGhost, outline: "none", fontFamily: "inherit", boxSizing: "border-box", opacity: isSearchPending ? 0.65 : 1, transition: "border-color 0.15s, opacity 0.1s" }} />
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
                {DIETARY.map(d => { const active = dietary.includes(d); const n = dietaryCounts[d] ?? 0; const dead = !active && n === 0; return <button key={d} onClick={() => setDietary(active ? dietary.filter(x => x !== d) : [...dietary, d])} aria-pressed={active} disabled={dead} title={dead ? "No items match with your current filters" : undefined} style={{ padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: dead ? "not-allowed" : "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? C.greenDark : C.border}`, background: active ? C.greenDark : "transparent", color: active ? C.white : C.inkSoft, opacity: dead ? 0.35 : 1, transition: "all 0.12s" }}>{d} ({n})</button> })}
                <div style={{ width: 1, height: 16, background: C.border, margin: "0 2px" }} aria-hidden="true" />
                {categories.map(cat => <button key={cat} onClick={() => setCategory(cat)} aria-pressed={category === cat} style={{ padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${category === cat ? C.teal : C.border}`, background: category === cat ? C.teal : "transparent", color: category === cat ? C.white : C.inkSoft, transition: "all 0.12s" }}>{cat} ({categoryCounts[cat] ?? 0})</button>)}
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
                                            ? <img src={item.thumbnail || alt!.thumbnail} loading="lazy" alt="" role="presentation" onError={e => { const el = e.currentTarget; const fb = item.id === card.item.id ? card.partner?.thumbnail : card.item.thumbnail; if (fb && el.src !== fb) { el.src = fb } else { el.style.display = "none" } }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                            : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.tealLight}, ${C.inkGhost})` }} />}
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
                                        {showMacros && (item.protein > 0 || item.carbs > 0) && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: C.orangeDark, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{item.protein}g</span><MacroBar value={item.protein} max={maxProtein} color={C.orange} /><span style={{ fontSize: 9, color: C.inkSoft, minWidth: 18, flexShrink: 0 }}>pro</span></div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: C.amber, fontWeight: 700, minWidth: 30, flexShrink: 0 }}>{item.carbs}g</span><MacroBar value={item.carbs} max={maxCarbs} color={C.yellow} /><span style={{ fontSize: 9, color: C.inkSoft, minWidth: 18, flexShrink: 0 }}>carb</span></div>
                                            </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            {item.calories > 0
                                                ? <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{item.calories}<span style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft }}> cal</span></span>
                                                : <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, fontStyle: "italic" }}>nutrition coming soon</span>}
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
    fontFamily: { type: ControlType.String, title: "Font Family", defaultValue: "'Hedvig Letters Sans', 'Helvetica Neue', sans-serif" },
    stickyOffset: { type: ControlType.Number, title: "Sticky Offset", defaultValue: 96, min: 0, max: 240, unit: "px", description: "Height of the site's floating nav — keeps the detail panel (and its close button) below it." },
})

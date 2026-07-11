// Mirror of Framer code file A11ySiteFixes.tsx (project: Crazy Bowls V1)
// Canonical copy lives in the Framer project; keep this in sync when editing there.
// Mounted inside the Navbar component so it runs on every page.

import { useEffect } from "react"
import { RenderTarget } from "framer"

/**
 * A11Y SITE FIXES — invisible runtime patcher
 *
 * Repairs accessibility issues that live in canvas components the design
 * tool can't express (icon-only links, broken tel href, address spacing,
 * footer heading skips, alt text for CSS background images). Ships inside
 * the Navbar so it runs on every page. Renders nothing visible.
 *
 * Fixes applied (re-applied on SPA navigation via MutationObserver):
 * 1. Icon-only social links get aria-labels (WCAG 4.1.2 / 2.4.4)
 * 2. tel: links whose href doesn't match the visible number get corrected,
 *    and tel:/mailto: links never open in a new tab
 * 3. "Ste 290Louisville" missing-space text fix
 * 4. target=_blank links with an accessible name get "(opens in new tab)"
 *    appended to their label
 * 5. Footer h6 column titles announce as level-2 headings (fixes h2 -> h6
 *    skips, WCAG 1.3.1) without changing their visual style
 * 6. Content-bearing CSS background images get role="img" + aria-label from
 *    the ALT_MANIFEST below (WCAG 1.1.1). Decorative backgrounds stay
 *    silent, which is correct. To add alt text for a new photo, add its
 *    framerusercontent filename + description to ALT_MANIFEST.
 * 7. Any remaining <img> with NO alt attribute gets alt="" so screen
 *    readers don't announce raw filenames (WCAG 1.1.1). Runs after the
 *    manifest so labeled images keep their real alt.
 *
 * @framerIntrinsicWidth 1
 * @framerIntrinsicHeight 1
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */

const SOCIAL_LABELS: Array<[string, string]> = [
    ["facebook.com", "Crazy Bowls & Wraps on Facebook"],
    ["instagram.com", "Crazy Bowls & Wraps on Instagram"],
    ["twitter.com", "Crazy Bowls & Wraps on X"],
    ["x.com", "Crazy Bowls & Wraps on X"],
    ["linkedin.com", "Crazy Bowls & Wraps on LinkedIn"],
    ["tiktok.com", "Crazy Bowls & Wraps on TikTok"],
    ["youtube.com", "Crazy Bowls & Wraps on YouTube"],
]

// Alt text for meaningful photos rendered as CSS backgrounds, keyed by the
// stable framerusercontent filename (survives Framer's responsive resizing).
// Written from page context — marketing/copy should refine wording over time.
const ALT_MANIFEST: Array<[string, string]> = [
    // Home hero bowl
    ["Xc4DMRF3GRui2rnSOOwcN4ns.png", "A Crazy Bowls signature bowl piled high with fresh ingredients"],
    // Home "Real ingredients. Ridiculously good." section photo
    ["Geitsp6FUpk9w8OSD5g6jEVGvQI.png", "Fresh bowl ingredients: greens, grains, and roasted vegetables"],
    // Home Lobster Rangoon section photo
    ["ecTvPtafLM3cN55ELxD3izbvaE.png", "Crispy Lobster Rangoon appetizer"],
    // Locations hero photo
    ["EKt73G6lNFHHfT5Cio5me5DLjE.png", "Inside a Crazy Bowls & Wraps restaurant"],
]

function hasAccessibleName(a: HTMLAnchorElement): boolean {
    if (a.getAttribute("aria-label") || a.getAttribute("aria-labelledby") || a.getAttribute("title")) return true
    if ((a.textContent || "").trim().length > 0) return true
    const img = a.querySelector("img[alt]") as HTMLImageElement | null
    if (img && img.alt.trim()) return true
    return false
}

function applyFixes(root: ParentNode) {
    // 1. Label icon-only social links; note new-tab behavior in the label
    root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        const href = a.href || ""
        const match = SOCIAL_LABELS.find(([host]) => href.includes(host))
        if (match && !hasAccessibleName(a)) {
            const newTab = a.target === "_blank"
            a.setAttribute("aria-label", match[1] + (newTab ? " (opens in new tab)" : ""))
            if (newTab && !a.rel.includes("noopener")) a.rel = (a.rel + " noopener").trim()
        }
    })

    // 2. tel:/mailto: sanity — href matches visible number; same-tab always
    root.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"], a[href^="mailto:"]').forEach((a) => {
        if (a.target === "_blank") a.removeAttribute("target")
        if (a.href.startsWith("tel:")) {
            const visible = (a.textContent || "").replace(/[^\d+]/g, "")
            const target = a.href.slice(4).replace(/[^\d+]/g, "")
            if (visible.length >= 10 && !target.endsWith(visible.slice(-10))) {
                a.setAttribute("href", "tel:+1" + visible.slice(-10))
            }
        }
    })

    // 3. Address text missing a space/linebreak
    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT)
    const targets: Text[] = []
    let n: Node | null
    while ((n = walker.nextNode())) {
        if ((n.textContent || "").includes("Ste 290Louisville")) targets.push(n as Text)
    }
    targets.forEach((t) => {
        t.textContent = (t.textContent || "").replace("Ste 290Louisville", "Ste 290, Louisville")
    })

    // 4. Named target=_blank links: append new-tab notice to accessible name
    root.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((a) => {
        if (a.getAttribute("aria-label")?.includes("opens in new tab")) return
        const name = a.getAttribute("aria-label") || (a.textContent || "").trim()
        if (name && !a.getAttribute("aria-label")) {
            a.setAttribute("aria-label", name + " (opens in new tab)")
        }
    })

    // 5. Footer h6 column titles -> announce as h2 (visuals untouched)
    root.querySelectorAll<HTMLHeadingElement>("footer h6").forEach((h) => {
        if (!h.getAttribute("aria-level")) {
            h.setAttribute("role", "heading")
            h.setAttribute("aria-level", "2")
        }
    })

    // 6. Alt text for meaningful CSS background images.
    // Framer renders background images either as CSS background-image or as an
    // <img> inside the frame — handle both, matching by filename.
    ALT_MANIFEST.forEach(([file, label]) => {
        // <img> variant: set real alt if missing/empty
        root.querySelectorAll<HTMLImageElement>(`img[src*="${file}"], img[srcset*="${file}"]`).forEach((img) => {
            if (!img.alt) img.alt = label
        })
        // CSS background variant: expose the frame as an image to AT
        root.querySelectorAll<HTMLElement>("div[style*='" + file + "']").forEach((div) => {
            if (!div.getAttribute("role")) {
                div.setAttribute("role", "img")
                div.setAttribute("aria-label", label)
            }
        })
    })

    // 7. Silence raw-filename announcements: img with NO alt attribute at all
    // becomes explicitly decorative. Manifest images (above) already have alt.
    root.querySelectorAll<HTMLImageElement>("img:not([alt])").forEach((img) => {
        img.setAttribute("alt", "")
    })
}

export default function A11ySiteFixes() {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        if (typeof document === "undefined" || isCanvas) return
        let raf = 0
        const run = () => applyFixes(document.body)
        // initial pass after hydration settles
        const t = setTimeout(run, 300)
        // re-apply after SPA navigations / late-mounted footers, debounced
        const mo = new MutationObserver(() => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => setTimeout(run, 150))
        })
        mo.observe(document.body, { childList: true, subtree: true })
        return () => {
            clearTimeout(t)
            cancelAnimationFrame(raf)
            mo.disconnect()
        }
    }, [isCanvas])

    // Invisible at runtime; tiny marker on canvas so editors can find it
    if (isCanvas) {
        return (
            <div style={{ width: 1, height: 1, background: "rgba(218,45,101,0.5)" }} title="A11y Site Fixes (runtime)" />
        )
    }
    return <div aria-hidden="true" style={{ width: 0, height: 0, overflow: "hidden" }} />
}

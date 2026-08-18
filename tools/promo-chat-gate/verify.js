const { chromium } = require("playwright-core")
const path = require("path")

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
const start = require("./server")
const PORT = 8731
const BASE = "http://127.0.0.1:" + PORT
const CATERING = BASE + "/catering/"
const MENU = BASE + "/menu/"

const fail = []
const ok = []
function check(cond, msg) {
    ;(cond ? ok : fail).push(msg)
    console.log((cond ? "  PASS  " : "  FAIL  ") + msg)
}

// Freeze the page clock so we can stand inside either offer phase on demand.
function clockScript(iso) {
    return `(() => {
      const FIXED = new Date(${JSON.stringify(iso)}).getTime();
      const Real = Date;
      const D = function (...a) {
        if (!(this instanceof D)) return Real(...a);
        return a.length === 0 ? new Real(FIXED) : new Real(...a);
      };
      D.prototype = Real.prototype;
      D.now = () => FIXED;
      D.parse = Real.parse; D.UTC = Real.UTC;
      window.Date = D;
    })()`
}

async function open(url, iso, width, height) {
    const browser = await chromium.launch({
        executablePath: EXE,
        args: ["--no-sandbox", "--no-proxy-server", "--hide-scrollbars"],
    })
    const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 2,
    })
    const errs = []
    page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message))
    page.on("console", (m) => {
        // favicon.ico is not part of the component; the harness has none
        if (m.type() === "error" && !/favicon/i.test(m.text()) && !/404/.test(m.text()))
            errs.push("CONSOLE: " + m.text())
    })
    page.on("requestfailed", (r) => {
        if (!/favicon/i.test(r.url())) errs.push("REQFAIL: " + r.url())
    })
    if (iso) await page.addInitScript(clockScript(iso))
    await page.goto(url, { waitUntil: "load" })
    return { browser, page, errs }
}

async function run(label, iso, expect, width, height) {
    console.log("\n=== " + label + " — " + width + "x" + height + " @ " + iso + " ===")
    const { browser, page, errs } = await open(CATERING, iso, width, height)

    const loc = await page.evaluate(() => location.pathname)
    check(loc.indexOf("/catering") !== -1, "harness path contains /catering")

    await page.waitForTimeout(8000)

    const teaserTxt = await page.evaluate(
        () => (document.body.innerText.match(/Free chip platter[^\n]*/) || [""])[0]
    )
    check(teaserTxt.indexOf(expect.threshold) !== -1, 'teaser shows ' + expect.threshold + ' — "' + teaserTxt + '"')

    const shown = await page.evaluate(() =>
        (window.dataLayer || []).some((e) => e && e.event === "czg_promo_teaser_shown")
    )
    check(shown, "czg_promo_teaser_shown fired to dataLayer")

    await page.screenshot({ path: "shot-" + label + "-1-teaser.png" })

    let sw = await page.evaluate(() => document.scrollingElement.scrollWidth)
    check(sw <= width, "no h-overflow with teaser (scrollWidth " + sw + " <= " + width + ")")

    const clicked = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button")).find((x) =>
            /Free chip platter/.test(x.innerText)
        )
        if (!b) return false
        b.click()
        return true
    })
    check(clicked, "teaser is a clickable button")

    await page.waitForTimeout(2200)
    const body = await page.evaluate(() => document.body.innerText)
    check(/CHIPYEAH/.test(body), "CHIPYEAH code visible in open panel")
    check(body.indexOf(expect.threshold) !== -1, expect.threshold + " threshold visible in open panel")
    check(
        body.indexOf(expect.stale) === -1,
        "stale threshold " + expect.stale + " absent from the panel"
    )
    check(
        /Tell me about the free chip platter offer/i.test(body),
        "promo question auto-sent into the transcript"
    )
    check(
        /comes along free/i.test(body),
        "local offer answer rendered into the transcript"
    )

    // The offer answer must be produced locally. Any network call here means
    // the grounding-hardened Worker gets the question and refuses + escalates.
    const sent = await page.evaluate(() => window.__sent)
    check(
        sent.length === 0,
        "offer question made ZERO Worker calls (answered locally) — calls: " +
            sent.length
    )
    check(
        !/ACTIVE OFFER CONTEXT/.test(JSON.stringify(sent)),
        "no offer facts injected into the outbound transcript"
    )
    check(
        /doesn't stack with other offers/.test(body),
        "canned offer terms rendered verbatim"
    )
    check(
        !/can't confirm|flag this for our team|contact-us/i.test(body),
        "no refusal / escalation language in the answer"
    )

    await page.screenshot({ path: "shot-" + label + "-2-open.png" })
    sw = await page.evaluate(() => document.scrollingElement.scrollWidth)
    check(sw <= width, "no h-overflow with panel open (scrollWidth " + sw + " <= " + width + ")")

    const rect = await page.evaluate(() => {
        const p = Array.from(document.querySelectorAll("div")).find((e) => {
            const r = e.getBoundingClientRect()
            return r.width > 240 && r.height > 300 && getComputedStyle(e).position === "fixed"
        })
        if (!p) return null
        const r = p.getBoundingClientRect()
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, w: Math.round(r.width), h: Math.round(r.height) }
    })
    if (rect) {
        console.log("        panel rect " + JSON.stringify(rect))
        check(
            rect.top >= 0 && rect.left >= 0 && rect.right <= width + 1 && rect.bottom <= height + 1,
            "panel fully inside the viewport"
        )
    }

    check(errs.length === 0, "no JS errors" + (errs.length ? " — " + errs.join(" | ") : ""))
    await browser.close()
}

async function gate(label, url, iso, expectPromo) {
    console.log("\n=== gate: " + label + " ===")
    const { browser, page } = await open(url, iso, 1200, 900)
    await page.waitForTimeout(7000)
    const has = await page.evaluate(() => /Free chip platter/.test(document.body.innerText))
    check(has === expectPromo, "promo " + (expectPromo ? "shows" : "stays hidden"))
    await browser.close()
}


// Proves the intercept is narrow: offer talk answered locally, everything else
// still reaches the Worker, and "zip code" is never mistaken for a promo code.
async function routing(label, iso) {
    console.log("\n=== routing: " + label + " ===")
    const { browser, page, errs } = await open(CATERING, iso, 1200, 900)
    await page.waitForTimeout(8000)
    await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button")).find((x) =>
            /Free chip platter/.test(x.innerText)
        )
        if (b) b.click()
    })
    await page.waitForTimeout(2000)

    const ask = async (text) => {
        await page.evaluate((t) => {
            const i = document.querySelector('input[aria-label="Message the Craziologist"]')
            const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, "value").set
            setter.call(i, t)
            i.dispatchEvent(new Event("input", { bubbles: true }))
            i.closest("form").dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true }))
        }, text)
        await page.waitForTimeout(2200)
        return page.evaluate(() => window.__sent.length)
    }

    let n = await ask("What's the code?")
    check(n === 0, '"What\'s the code?" answered locally (calls: ' + n + ")")

    n = await ask("My zip code is 63105, which store is closest?")
    check(n === 1, '"zip code" question routed to the Worker (calls: ' + n + ")")

    n = await ask("How many wraps for 30 people?")
    check(n === 2, "ordinary catering question routed to the Worker (calls: " + n + ")")

    // Offer phrasings that must never reach the grounding-hardened Worker.
    for (const q of [
        "Any specials on catering right now?",
        "Is there a promotion going on?",
        "Do I get anything free with a big order?",
        "any deals?",
        "do you have a coupon",
    ]) {
        const before = n
        n = await ask(q)
        check(n === before, 'offer phrasing answered locally: "' + q + '"')
    }

    // Allergen and macro questions must ALWAYS reach the Worker, promo or not.
    for (const q of [
        "Any gluten free options for catering?",
        "Do you have nut free platters?",
        "How much protein in the power bowl?",
    ]) {
        const before = n
        n = await ask(q)
        check(n === before + 1, 'nutrition question routed to the Worker: "' + q + '"')
    }

    check(errs.length === 0, "no JS errors" + (errs.length ? " — " + errs.join(" | ") : ""))
    await browser.close()
}

;(async () => {
    const server = await start(PORT)
    const P1 = { id: "chip-yeah-catering-150", threshold: "$150", stale: "$100" }
    const P2 = { id: "chip-yeah-catering-100", threshold: "$100", stale: "$150" }

    // Phase 1 — today
    await run("p1-desktop", "2026-08-18T13:00:00-05:00", P1, 1200, 900)
    await run("p1-mobile", "2026-08-18T13:00:00-05:00", P1, 390, 844)

    // Phase 2 — Wednesday morning, after the threshold drops
    await run("p2-desktop", "2026-08-19T09:00:00-05:00", P2, 1200, 900)
    await run("p2-mobile", "2026-08-19T09:00:00-05:00", P2, 390, 844)

    await routing("intercept is narrow", "2026-08-19T09:00:00-05:00")

    // Targeting gates
    await gate("/menu, no campaign param — control", MENU, "2026-08-18T13:00:00-05:00", false)
    await gate(
        "/menu + utm_campaign — email traffic",
        MENU + "?utm_campaign=catering-chip-platter-aug",
        "2026-08-18T13:00:00-05:00",
        true
    )
    // Midnight gap between phases: 8/19 00:00:00 is inside phase 2, but the
    // dead second at 8/18 23:59:59.5 must not resurrect phase 1 copy.
    await gate("/catering after the last phase ends", CATERING, "2026-09-01T09:00:00-05:00", false)
    await gate("/catering before the first phase starts", CATERING, "2026-08-01T09:00:00-05:00", false)
    await gate("/catering at the midnight handoff", CATERING, "2026-08-19T00:00:30-05:00", true)

    server.close()
    console.log("\n---------------------------------------------")
    console.log("PASSED: " + ok.length + "   FAILED: " + fail.length)
    if (fail.length) {
        fail.forEach((f) => console.log("  x " + f))
        process.exit(1)
    }
})()

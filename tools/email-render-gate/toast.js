// Does the design survive Toast's round-trip?
//
// Toast rebuilds the pasted HTML through MJML: every conditional comment is destroyed and
// font-weight:normal is appended to every heading. Both behaviours were measured against a
// campaign Toast actually sent, not inferred. build.js models them; this asserts the design
// still holds afterwards.
//
// Two checks, both of which FAILED on the email that shipped on 2026-09-22:
//   HEADING WEIGHT — every heading still renders at its intended weight in toast.html.
//   BUTTONS        — in toastword.html (Toast, then the Word engine) every CTA still has a
//                    real tappable box. With the VML twin gone, the HTML anchor is all that
//                    is left, and Word drops padding from it, so the padding has to come
//                    from the CELL via mso-padding-alt or the button collapses.
const { chromium } = require("playwright-core")
const http = require("http"), fs = require("fs"), path = require("path")
const SITE = path.join(__dirname, "site"), PORT = 8873
const MIME = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif" }
const fails = [], oks = []
const t = (c, m) => (c ? oks : fails).push(m)

const srv = http.createServer((q, r) => {
    const f = path.join(SITE, decodeURIComponent(q.url.split("?")[0]))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
    r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" })
    fs.createReadStream(f).pipe(r)
})
srv.listen(PORT, "127.0.0.1", async () => {
    const b = await chromium.launch({
        executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args: ["--no-sandbox", "--no-proxy-server", "--hide-scrollbars"],
    })
    // SCOPE. Toast's behaviour was measured on Wild Eggs sends. CBW goes through Paytronix,
    // whose transformations have NOT been measured, so this gate must not pretend to judge
    // it: a check that fires outside the evidence it was built from is a guess wearing a
    // gate's uniform. Skip, loudly, rather than pass quietly.
    const brand = fs.readFileSync(path.join(SITE, "modern.html"), "utf8").match(/data-brand="([^"]*)"/)
    if (!brand || brand[1] !== "wild-eggs") {
        console.log(`  skip      not a Toast send (brand=${brand ? brand[1] : "unknown"}); Paytronix behaviour is unmeasured`)
        await b.close(); srv.close(); process.exit(0)
    }

    // --- heading weight
    let p = await b.newPage({ viewport: { width: 900, height: 1200 }, reducedMotion: "reduce" })
    await p.goto(`http://127.0.0.1:${PORT}/toast.html`, { waitUntil: "networkidle" })
    await p.waitForTimeout(300)
    const heads = await p.evaluate(() =>
        [...document.querySelectorAll("h1,h2,h3")].map((h) => ({
            // The HEADING ELEMENT'S OWN computed weight. An earlier version of this check
            // sampled the first weight-carrying span inside the heading, which let the H1
            // pass at 700 on the strength of its italic "are back." span while the words
            // before it rendered at 400. Sampling a child is not measuring the heading.
            tag: h.tagName, txt: h.textContent.trim().slice(0, 34),
            w: parseInt(getComputedStyle(h).fontWeight),
        })))
    for (const h of heads)
        t(h.w >= 700, `${h.tag} "${h.txt}" renders at ${h.w}` + (h.w >= 700 ? "" : "  -> FLATTENED by Toast"))
    await p.close()

    // --- buttons after Toast, in the Word engine
    p = await b.newPage({ viewport: { width: 900, height: 1200 }, reducedMotion: "reduce" })
    await p.goto(`http://127.0.0.1:${PORT}/toastword.html`, { waitUntil: "networkidle" })
    await p.waitForTimeout(300)
    const btns = await p.evaluate(() =>
        [...document.querySelectorAll("a")].filter((a) => {
            const bg = getComputedStyle(a.closest("td") || a).backgroundColor
            return bg && bg !== "rgba(0, 0, 0, 0)" && a.textContent.trim().length > 3 &&
                   getComputedStyle(a).textTransform === "uppercase"
        }).map((a) => {
            const td = a.closest("td")
            const alt = (td.getAttribute("style") || "").match(/mso-padding-alt:\s*(\d+)px/)
            return { text: a.textContent.trim().slice(0, 26), cellH: Math.round(td.getBoundingClientRect().height),
                     textH: Math.round(a.getBoundingClientRect().height), msoPad: alt ? parseInt(alt[1]) : 0 }
        }))
    for (const x of btns)
        t(x.msoPad >= 12 || x.cellH >= x.textH + 12,
          `button "${x.text}" keeps a box in Outlook (mso-padding-alt ${x.msoPad}px, cell ${x.cellH}px vs text ${x.textH}px)`)
    if (!btns.length) fails.push("found no CTA to check — the selector missed, which is not a pass")
    await p.close(); await b.close(); srv.close()

    oks.forEach((m) => console.log("  ok        " + m))
    fails.forEach((m) => console.log("  FAIL      " + m))
    console.log(fails.length ? `\n${fails.length} FAILED` : `\nall ${oks.length} passed`)
    process.exit(fails.length ? 1 : 0)
})

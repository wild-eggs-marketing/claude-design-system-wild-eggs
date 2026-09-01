// Produce the PASTE-READY build: the same email with every documentation comment removed.
//
// WHY THIS EXISTS. Two reasons, and both have bitten this template.
//
//  1. Paytronix has stripped comments on paste before. If a comment is load bearing, the
//     email breaks silently in production. Shipping a file with no removable comments at all
//     means there is nothing left for a paste to strip.
//  2. A comment can BREAK THE HTML. A literal "-->" typed inside a documentation comment
//     terminates it early, and everything after it renders as visible text in the email. That
//     happened on this template: roughly forty lines of engineering notes appeared above the
//     logo and, because one of them was long, created a 541px min-content floor that made the
//     whole email scroll sideways on a phone.
//
// WHAT IS KEPT, deliberately:
//   - conditional comments <!--[if mso]> ... <![endif]-->  These are LIVE MARKUP in Outlook,
//     not documentation. Removing them removes the Word stylesheet and the ghost table.
//   - CSS comments inside <style>. They are not HTML comments, a paste cannot strip them,
//     and they are where the Outlook rules explain themselves.
//
// The output must render pixel-identical to the master in every variant. diff.js proves it.

const fs = require("fs")

const src = process.argv[2]
const out = process.argv[3]
if (!src || !out) {
    console.error("usage: node strip.js <master.html> <out.PASTE.html>")
    process.exit(1)
}

const h = fs.readFileSync(src, "utf8")
let res = ""
let i = 0
let removed = 0

while (i < h.length) {
    const open = h.indexOf("<!--", i)
    if (open === -1) {
        res += h.slice(i)
        break
    }
    res += h.slice(i, open)

    // Conditional comment: live markup in Word. Copy it through untouched.
    if (h.startsWith("<!--[if", open)) {
        const end = h.indexOf("<![endif]-->", open)
        if (end === -1) {
            // Unbalanced conditional. Refuse to guess: copy the rest verbatim and let the
            // gate catch whatever this is.
            res += h.slice(open)
            break
        }
        res += h.slice(open, end + "<![endif]-->".length)
        i = end + "<![endif]-->".length
        continue
    }

    const close = h.indexOf("-->", open)
    if (close === -1) {
        // An unterminated comment is exactly the failure this script was written after.
        console.error("FATAL: unterminated HTML comment at offset " + open)
        process.exit(1)
    }
    removed++
    i = close + 3
}

fs.writeFileSync(out, res)
console.log(
    `stripped ${removed} documentation comments: ${h.length}B -> ${res.length}B (${Math.round(
        (1 - res.length / h.length) * 100
    )}% smaller)`
)

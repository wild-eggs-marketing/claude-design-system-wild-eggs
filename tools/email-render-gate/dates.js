// DATES — catch temporal claims that are true on send day and false a week later.
//
// Written after the Bowl Games season opener shipped body copy reading "Receipts from Sunday
// count". On the send date that resolved to the correct September 20. Read the following
// Monday it resolves to September 27, which is outside the qualifying window, so the sentence
// silently becomes false while nothing about it looks wrong. The master file it was compressed
// from said "from Sunday, September 20 onward"; the date was dropped in an edit and no gate
// existed that could notice.
//
// Emails are read late. They sit in inboxes, they get forwarded, they get opened from a
// promotions tab on a Saturday. Any temporal claim that depends on the reader's "today" is a
// defect, not a style choice.
//
// Four checks:
//   1. BARE WEEKDAY      - a weekday name with no explicit date near it
//   2. UNFILLED PLACEHOLDER - [SOMETHING] left in the copy
//   3. WEEKDAY/DATE MISMATCH - "Sunday, September 20" where that date is not a Sunday
//   4. RELATIVE WORDS    - "yesterday", "tomorrow", "last week", "this coming"
//
// Scope: the MARKETING BODY only. The legal block is allowed bare weekdays ("lock Saturday
// night" is a recurring weekly rule there, not a dated claim), and documentation comments are
// stripped from the paste build anyway.
//
// Run: node dates.js <paste-build.html>

const fs = require("fs")
const path = require("path")

const SRC = process.argv[2]
if (!SRC) {
    console.error("usage: node dates.js <file.html>")
    process.exit(2)
}

let html = fs.readFileSync(SRC, "utf8")

// Strip comments, style and head - we only audit visible body copy.
html = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")

// Pull the legal block out and audit it separately with looser rules. It is the <p class="fine">
// and everything after it in the footer cell.
const fineIdx = html.search(/class="fine"/)
const bodyHtml = fineIdx === -1 ? html : html.slice(0, fineIdx)
const legalHtml = fineIdx === -1 ? "" : html.slice(fineIdx)

const text = (h) =>
    h.replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&ndash;/g, "-")
        .replace(/&amp;/g, "&")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim()

const body = text(bodyHtml)
const legal = text(legalHtml)
const all = body + " " + legal

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
const DAYS = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"

const fails = []
const notes = []

// ---------------------------------------------------------------- 1. bare weekday in body
// A weekday is acceptable when an explicit date sits within ~40 characters of it, either side.
// "Sunday, September 20" passes. "from Sunday" does not.
{
    const re = new RegExp(`\\b(${DAYS})\\b`, "g")
    let m
    while ((m = re.exec(body)) !== null) {
        const from = Math.max(0, m.index - 40)
        const to = Math.min(body.length, m.index + m[0].length + 40)
        const around = body.slice(from, to)
        const anchored =
            new RegExp(`(${MONTHS})\\s+\\d{1,2}`, "i").test(around) ||
            /\b\d{1,2}(st|nd|rd|th)\b/i.test(around) ||
            /\b\d{1,2}\/\d{1,2}\b/.test(around)
        // A weekday used as a recurring rule ("every Saturday", "Saturdays") is not a dated
        // claim and does not decay.
        const recurring =
            /\b(every|each)\s+$/i.test(body.slice(from, m.index)) || /^s\b/i.test(body.slice(m.index + m[0].length, m.index + m[0].length + 2))
        // RESOLVED ELSEWHERE. "this Saturday" in a burst is fine when the body ALSO says
        // "this Saturday, October 3" somewhere a reader will see, because the email as a
        // whole disambiguates itself. This is deliberately narrow: the SAME weekday must be
        // anchored to an explicit date in the body. It does not let an unanchored weekday
        // through just because some other date exists somewhere in the file, which is why
        // the original "Receipts from Sunday count" defect still fails - no "Sunday" was
        // ever anchored anywhere in that email.
        const resolvedElsewhere = new RegExp(
            `\\b${m[0]}\\b,?\\s+(${MONTHS})\\s+\\d{1,2}|(${MONTHS})\\s+\\d{1,2},?\\s+\\(?${m[0]}\\b`,
            "i"
        ).test(body)
        if (!anchored && !recurring && !resolvedElsewhere) {
            fails.push(
                `BARE WEEKDAY in body: "${m[0]}" with no date within 40 chars.\n` +
                    `            ...${around.trim()}...\n` +
                    `            A reader opening this next week resolves it to a different date.\n` +
                    `            Anchor it: "${m[0]}, <Month> <D>" or drop the weekday for the date.`
            )
        }
    }
}

// ---------------------------------------------------------------- 2. unfilled placeholders
{
    const re = /\[([A-Z][A-Z0-9 _-]{2,30})\]/g
    let m
    while ((m = re.exec(all)) !== null) {
        fails.push(
            `UNFILLED PLACEHOLDER: "${m[0]}" is still in the copy.\n` +
                `            It is visible on purpose so it cannot ship unnoticed. Fill it in.\n` +
                `            Do NOT delete the bracket to make the sentence read smoothly.`
        )
    }
}

// ---------------------------------------------------------------- 3. weekday/date mismatch
{
    const re = new RegExp(`\\b(${DAYS}),?\\s+(${MONTHS})\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`, "gi")
    let m
    while ((m = re.exec(all)) !== null) {
        const [, dayName, monthName, dayNum, yearRaw] = m
        const year = yearRaw ? Number(yearRaw) : new Date().getUTCFullYear()
        const monthIdx = MONTHS.split("|").findIndex((x) => x.toLowerCase() === monthName.toLowerCase())
        const d = new Date(Date.UTC(year, monthIdx, Number(dayNum)))
        const actual = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()]
        if (actual.toLowerCase() !== dayName.toLowerCase()) {
            fails.push(
                `WEEKDAY/DATE MISMATCH: "${m[0].trim()}" - ${monthName} ${dayNum}, ${year} is a ${actual}.`
            )
        } else {
            notes.push(`${m[0].trim()} checks out (${monthName} ${dayNum} ${year} is a ${actual})`)
        }
    }
}

// ---------------------------------------------------------------- 4. reader-relative words
{
    const BAD = [
        "yesterday", "tomorrow", "today", "tonight",
        "last week", "next week", "this week(?!end)", "this coming",
        "as of now", "right now", "currently", "just launched", "starts today",
    ]
    for (const w of BAD) {
        const re = new RegExp(`\\b(${w})\\b`, "gi")
        let m
        while ((m = re.exec(body)) !== null) {
            const from = Math.max(0, m.index - 35)
            const to = Math.min(body.length, m.index + m[0].length + 35)
            fails.push(
                `READER-RELATIVE TIME in body: "${m[0]}"\n` +
                    `            ...${body.slice(from, to).trim()}...\n` +
                    `            Resolves against the READER's clock, not the send date.`
            )
        }
    }
}

// ---------------------------------------------------------------- report
for (const n of notes) console.log(`      PASS  ${n}`)

if (fails.length === 0) {
    console.log("      PASS  no decaying temporal claims in the marketing body")
    console.log("      PASS  no unfilled placeholders")
    process.exit(0)
}

for (const f of fails) console.log(`      FAIL  ${f}`)
console.log(`      -> ${fails.length} temporal defect${fails.length === 1 ? "" : "s"}`)
process.exit(1)

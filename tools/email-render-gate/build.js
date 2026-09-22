// Produce the client variants we test against, from the one source file.
//
//   modern.html  - what a browser-engine client sees (Apple Mail, iOS Mail, Gmail
//                  app/web, Outlook.com, Outlook for Mac, Yahoo, Samsung, Thunderbird).
//   word.html    - what OUTLOOK CLASSIC on Windows sees. Word engine, not a browser.
//   gmail.html   - Gmail's extra restrictions on top of modern.
//   noimg.html   - images blocked, which is the default state for a large share of
//                  Outlook and corporate inboxes on first open.
//
// The Word transform is the important one. It applies, in order, the documented
// Word-engine behaviours that caused the failures photographed in the last send:
//
//   1. @media blocks are never read           -> strip every @media block
//   2. conditional <!--[if mso]> content IS read -> unwrap it into live markup
//   3. no webfonts                             -> drop the Google Fonts <link>
//   4. no display:inline-block                 -> strip that declaration
//   5. no padding on inline elements (<a>)     -> strip padding from anchors
//   6. no border-radius / object-fit / max-width
//
// Sources for the behaviour list: caniemail.com per-property Outlook Windows data,
// and Microsoft's own "Word HTML rendering" guidance for Outlook 2007+.

const fs = require("fs")
const path = require("path")

const SRC = process.argv[2] || "/tmp/tk/taco-kit-draft-day.html"
const OUT = path.join(__dirname, "site")
let src = fs.readFileSync(SRC, "utf8")

// Point the REPLACE-ME tokens at local placeholders sized to the real photos.
function withImages(h) {
    return h
        .replace(/https:\/\/paytronix-bee[^"']*Queso%20CBW\.png/g, "queso_cbw.png")
        .replace(/https:\/\/paytronix-bee[^"']*Draft%20Day_CBW\.png/g, "draftday_cbw.png")
        .replace(/https:\/\/paytronix-bee[^"']*opt_Queso_hero\.jpg/g, "opt_Queso_hero.jpg")
        .replace(/https:\/\/paytronix-bee[^"']*opt_Queso_panel\.jpg/g, "opt_Queso_panel.jpg")
        .replace(/https:\/\/paytronix-bee[^"']*opt_TacoKit_1_hero\.jpg/g, "opt_TacoKit_1_hero.jpg")
        .replace(/https:\/\/paytronix-bee[^"']*opt_TacoKit_2_Football\.jpg/g, "opt_TacoKit_2_Football.jpg")
        .replace(/https:\/\/paytronix-bee[^"']*opt_TacoKit_3_protein\.jpg/g, "opt_TacoKit_3_protein.jpg")
        .replace(/https:\/\/paytronix-bee[^"']*Logo[^"']*/g, "logo.png")
        .replace(/https:\/\/paytronix-bee[^"']*10\.55\.02[^"']*/g, "tt_sw.png")
        .replace(/https:\/\/paytronix-bee[^"']*All%20Drinks_1\.png/g, "tt_lineup.png")
        // Saturday queso sends + Family Night. Mapped by the distinctive part of the
        // screenshot filename, because the real names carry a NARROW NO-BREAK SPACE (U+202F)
        // before AM/PM that survives as %E2%80%AF in the URL.
        .replace(/https:\/\/paytronix-bee[^"']*3\.56\.33[^"']*/g, "sat_pull.png")
        .replace(/https:\/\/paytronix-bee[^"']*8\.46\.28[^"']*/g, "fn_drivethru.png")
        .replace(/https:\/\/paytronix-bee[^"']*Family%20Night_2\.jpg/g, "fn_kid.jpg")
        .replace(/https:\/\/paytronix-bee[^"']*photo-drive-thru-handoff_1\.jpg/g, "fn_handoff.jpg")
        // Wild Eggs (Mailjet CDN). Mapped by asset UUID to local files of the real dimensions,
        // so the geometry assertions measure the same pixels the send will.
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*adb58b99[^"']*/g, "we_logo.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*5b86d0f2[^"']*/g, "we_hero.jpg")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*bba95e85[^"']*/g, "we_chip1.jpg")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*726854ad[^"']*/g, "we_chip2.jpg")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*6e339e92[^"']*/g, "we_portrait.jpg")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*9e1693d1[^"']*/g, "we_waffle.jpg")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*b00dcca8[^"']*/g, "we_waffle_hero.jpg")
        // Fall LTO 2026. The hero is a GIF; the local stand-in is its FIRST FRAME as PNG at
        // the same 600x600, which is what the geometry assertions need. Frame zero is also
        // exactly what Outlook Classic renders, so this is the honest thing to measure.
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*d2e4eeda[^"']*/g, "we_fall_hero.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*daacba8d[^"']*/g, "we_e1_hero.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*d5fe96db[^"']*/g, "we_e1_hero.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*6da51a40[^"']*/g, "we_fall_lineup.jpg")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*62567030[^"']*/g, "we_fall_mimosa.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*efd51abf[^"']*/g, "we_fall_latte.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*c53fde98[^"']*/g, "we_fb.png")
        .replace(/https:\/\/0nlz6\.mjt\.lu[^"']*605da7fb[^"']*/g, "we_ig.png")
        .replace(/https:\/\/paytronix-bee[^"']*ribbon[^"']*/gi, "ribbon.png")
}

// ---- strip balanced @media blocks (regex cannot count braces; do it by hand) ----
function stripAtMedia(css) {
    let out = ""
    let i = 0
    while (i < css.length) {
        const at = css.indexOf("@media", i)
        if (at === -1) {
            out += css.slice(i)
            break
        }
        out += css.slice(i, at)
        let j = css.indexOf("{", at)
        if (j === -1) break
        let depth = 1
        j++
        while (j < css.length && depth > 0) {
            if (css[j] === "{") depth++
            else if (css[j] === "}") depth--
            j++
        }
        i = j
    }
    return out
}

// ---------------- MODERN ----------------
let modern = withImages(src)
// conditional comments are inert in every browser engine; leave them as comments.
fs.writeFileSync(path.join(OUT, "modern.html"), modern)

// ---------------- GMAIL ----------------
// Gmail supports <style> in head and media queries, but strips position, and
// historically drops properties it does not recognise rather than the whole rule.
let gmail = modern.replace(/position\s*:\s*(absolute|fixed|relative)\s*;?/gi, "")
fs.writeFileSync(path.join(OUT, "gmail.html"), gmail)

// ---------------- NO IMAGES ----------------
let noimg = modern.replace(/src="[^"]*\.(png|jpg)"/g, 'src="missing-on-purpose.png"')
fs.writeFileSync(path.join(OUT, "noimg.html"), noimg)

// ---------------- WORD / OUTLOOK CLASSIC ----------------
let word = modern

// 2. Word DOES read conditional comments. Unwrap them so the simulation sees
//    exactly what Word sees: the mso stylesheet and the ghost table.
word = word.replace(/<!--\[if mso\]>([\s\S]*?)<!\[endif\]-->/g, "$1")
word = word.replace(/<!--\[if mso \| IE\]>([\s\S]*?)<!\[endif\]-->/g, "$1")

// 2b. The OTHER half of the bulletproof-button pattern. Content wrapped in the
//     downlevel-REVEALED form `<!--[if !mso]><!--> ... <!--<![endif]-->` is markup every
//     other client sees and Outlook does NOT. Leaving it in meant word.html rendered BOTH
//     the VML button and the HTML one, and the geometry assertions measured the HTML
//     anchor Word would never draw - reporting a collapsed 19px button that no Outlook
//     user could ever see. Remove it so the simulation matches what Word actually gets.
word = word.replace(/<!--\[if !mso\]><!-->[\s\S]*?<!--<!\[endif\]-->/g, "")

// 3. No webfonts.
word = word.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "")
word = word.replace(/<link[^>]*fonts\.gstatic[^>]*>/g, "")
word = word.replace(/<link[^>]*preconnect[^>]*>/g, "")

// 1. No media queries. Do this AFTER unwrapping mso so we do not touch that block.
word = word.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (m, attrs, css) => {
    return "<style" + attrs + ">" + stripAtMedia(css) + "</style>"
})

// 4. display:inline-block is not supported. Word treats it as block.
word = word.replace(/display\s*:\s*inline-block\s*;?/gi, "")

// 5. Padding is not applied to inline elements. Strip it from every anchor's
//    inline style. This is what collapsed the buttons in the real screenshots.
word = word.replace(/<a\b([^>]*)style="([^"]*)"/gi, (m, pre, style) => {
    const stripped = style.replace(/(^|;)\s*padding[^;]*/gi, "$1")
    return "<a" + pre + 'style="' + stripped + '"'
})

// 6. Unsupported box properties.
word = word.replace(/border-radius\s*:[^;"]*;?/gi, "")
word = word.replace(/object-fit\s*:[^;"]*;?/gi, "")
word = word.replace(/max-width\s*:[^;"]*;?/gi, "")
// Word also ignores CSS animations entirely.
word = word.replace(/animation\s*:[^;"]*;?/gi, "")

// Force the Word font situation: no Passion One, no Bricolage, no Fraunces on a
// Windows box. Windows font substitution maps an unknown first-choice family
// through its own table rather than walking the CSS fallback list, and in the
// real screenshots that produced a SERIF. Model that worst case explicitly.
word = word.replace(/'Passion One'/g, "'__MissingDisplay'")
word = word.replace(/'Bricolage Grotesque'/g, "'__MissingBody'")
word = word.replace(/'Fraunces'/g, "'__MissingSerif'")
word = word.replace(/Fraunces,/g, "'__MissingSerif',")
word =
    word.replace(
        "</head>",
        `<style>
  /* Windows substitution worst case: an unresolvable first family lands on a serif. */
  @font-face { font-family:'__MissingDisplay'; src:local('Times New Roman'); }
  @font-face { font-family:'__MissingBody';    src:local('Times New Roman'); }
  @font-face { font-family:'__MissingSerif';   src:local('Times New Roman'); }
</style></head>`
    )

fs.writeFileSync(path.join(OUT, "word.html"), word)

// ---------------- TOAST ROUND-TRIP ----------------
// MEASURED, not assumed, against the campaign Toast actually sent on 2026-09-22
// (view URL, 44KB, MJML fingerprints: mj-outlook-group-fix, mj-column, [if lte mso 11]).
//
// Toast's campaign builder does NOT paste raw HTML. It parses the source into its own
// block model and re-emits the email through MJML. Two consequences, both verified by
// diffing the sent output against the file that was pasted:
//
//   1. EVERY conditional comment is destroyed. 4 v:roundrect -> 0, the mso font
//      stylesheet gone, the ghost table gone. This is not a sanitizer the sender can
//      avoid by re-pasting; it is how the builder works. Telling anyone to "paste it
//      again and check for roundrect" was advice that could never have worked.
//   2. font-weight:normal is APPENDED to the inline style of every heading element.
//      8 headings in, 8 injections out. It lands last in the same declaration block,
//      so it beats an earlier font-weight:900 and the headline renders at 400.
//      Elements that are not h1-h6 are untouched.
//
// What survives, also measured: the <style> block, classes, aria attributes, inline
// styles, white-space:nowrap spans, data-ogsc rules.
function toastTransform(h) {
    // Conditional content is dropped; the [if !mso] HTML becomes visible to EVERYONE,
    // including Word, because the VML twin that used to hide behind it is gone.
    h = h.replace(/<!--\[if !mso\]><!-->/g, "").replace(/<!--<!\[endif\]-->/g, "")
    h = h.replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/g, "")
    // The heading normalisation.
    h = h.replace(/<(h[1-6])\b([^>]*?)style="([^"]*)"/gi, (m, tag, pre, style) =>
        `<${tag}${pre}style="${style};font-weight:normal"`)
    return h
}

fs.writeFileSync(path.join(OUT, "toast.html"), toastTransform(modern))

// The variant that matters most and never existed: what an Outlook Classic reader sees
// when the email went out through Toast. Toast first, then the Word engine on top.
let toastword = toastTransform(modern)
toastword = toastword.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "")
toastword = toastword.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "")
toastword = toastword.replace(/display\s*:\s*inline-block\s*;?/gi, "")
toastword = toastword.replace(/<a\b([^>]*)style="([^"]*)"/gi, (m, pre, style) =>
    `<a${pre}style="${style.replace(/(^|;)\s*padding[^;]*/gi, "")}"`)
toastword = toastword.replace(/border-radius\s*:[^;"]*;?/gi, "")
toastword = toastword.replace(/max-width\s*:[^;"]*;?/gi, "")
toastword = toastword.replace(/animation\s*:[^;"]*;?/gi, "")
fs.writeFileSync(path.join(OUT, "toastword.html"), toastword)

// ---------------- STYLESHEET STRIPPED ----------------
// The failure that actually shipped. Somewhere between the paste into Paytronix and
// Outlook Classic, the <style> block and/or the conditional comment stopped taking
// effect, and the email fell back to its INLINE styles. Previously that meant an 84px
// headline at line-height 0.88, which crashed into the chip above it.
// This variant keeps ONLY what can never be stripped: the inline attributes. If the
// email is still intact here, it is intact everywhere.
let nostyle = modern
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--\[if mso[\s\S]*?<!\[endif\]-->/g, "")
    .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "")
    .replace(/<link[^>]*preconnect[^>]*>/g, "")
fs.writeFileSync(path.join(OUT, "nostyle.html"), nostyle)

// ---------------- CONDITIONAL COMMENTS STRIPPED ----------------
// Paytronix has stripped comments on a paste before, on the Wild Eggs side. This keeps
// the stylesheets but removes every <!--[if mso]--> block, which is what a
// comment-stripping paste produces.
let nocond = modern.replace(/<!--\[if mso[\s\S]*?<!\[endif\]-->/g, "")
fs.writeFileSync(path.join(OUT, "nocond.html"), nocond)

console.log("built: modern.html  gmail.html  noimg.html  word.html  nostyle.html  nocond.html")

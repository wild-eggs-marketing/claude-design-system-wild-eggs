# Wild Eggs — pending MCP fixes (July 7, 2026)

Framer MCP dropped mid-session. Status of each planned fix:

## 1. SchemaInjector.tsx (codeFileId cnzbZUJ) — SENT, UNCONFIRMED
An updateCodeFile call was sent and timed out — verify whether it applied before re-sending.
The full corrected file is in `SchemaInjector.fixed.tsx`. Changes vs. original:
- SAME_AS → facebook.com/wildeggsrestaurants + instagram.com/wildeggsrestaurants (removed wrong /wildeggs handles and unverified twitter)
- buildMenuItem: sanitizePrice() strips "$"/text so Offer.price is numeric (fixes invalid markup on all 138 item pages)
- buildWebsite: WebPage `name` now derived from the URL path label ("Catering | Wild Eggs") instead of metaDescription.substring(0,70)
- Shared PATH_LABELS/labelForPathPart used by both WebPage name and breadcrumbs

## 2. Locations CMS (collection YAC695LcL) — NOT YET APPLIED
- **columbus-oh** (Coming Soon record): replace "Coming soon!" placeholders —
  Meta Title: "Wild Eggs Columbus (Westerville) | Breakfast & Brunch Coming Soon"
  Meta Description: "Wild Eggs is coming to Westerville, OH — scratch-kitchen breakfast & brunch at 5912 Old Hamilton Rd. Opening soon; follow @wildeggsrestaurants for the opening date."
  FAQ1: "When does Wild Eggs Columbus open?" / "Wild Eggs Westerville (Columbus area) is opening soon at 5912 Old Hamilton Rd. Follow @wildeggsrestaurants or check this page for the opening date."
  FAQ2: "Where will Wild Eggs Columbus be located?" / "At 5912 Old Hamilton Rd, Westerville, OH 43081, in the Hamilton Quarter area northeast of Columbus."
  FAQ3: "What does Wild Eggs serve?" / "Scratch-kitchen breakfast, brunch, and lunch — eggs Benedict, pancakes, omelets, and brunch cocktails — served daily until mid-afternoon."
  Also fix Phone placeholder (leave empty rather than "Coming soon!").
- **Canonical standardization** — DECISION NEEDED first: page route is /locations/:address_3, so canonicals should be https://www.wildeggs.com/locations/{slug}; 19 of 20 records currently point to wildeggs.com/{slug} (columbus-oh alone is on the /locations/ pattern). Confirm no top-level redirects exist, then update the 19.
- **Wisely→Toast FAQ rewrites (7 records):** downtown-cincinnati, dupont, new-albany, jeffersontown, tates-creek, downtown-louisville, westport-village — replace "waitlist.getwisely.com/..." answer text with: "Join the waitlist online from this page or at the door — we seat from the same list." (waitlist link fields already point to Toast).
- **Oakley:** FAQ answer quotes a raw Toast UUID URL — replace with the same generic waitlist sentence.
- **Palomar:** align order links — set both order fields to https://order.toasttab.com/online/wild-eggs-palomar
- **All 20:** replace "Hours: See hours card on this page or call ahead." in Main Content with the record's actual Hours Weekday/Weekend text.
- **Jeffersontown + Jeffersonville:** meta descriptions promise "Reservations" but Reservations URL is empty everywhere and schema says acceptsReservations:false — drop the word "Reservations" from those two meta descriptions (or add real reservation links).

## 3. Menu Items CMS (collection l2oD2amch) — CONTENT NEEDED, NOT A BOT JOB
60 items missing Nutritional Information, 52 missing Alergen Warnings (worst: Catering, Kids, Drinks, Sides). biscuits-and-gravy and french-fries contain <br>-only placeholder HTML. Requires real nutrition/allergen data from ops — do not fabricate.

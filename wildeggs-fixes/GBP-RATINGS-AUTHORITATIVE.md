# Wild Eggs — authoritative Google ratings (Places API, July 7, 2026)

Source: Places API (New) via service account, project deep-byte-500814-m1. All 19 open
locations matched by street address; place_ids in places-ratings-2026-07-07.json.
Supersedes the search-snippet baseline (GBP-RATINGS-BASELINE.md), which was materially
wrong for several locations (e.g. J-Town is 4.7 not 4.2; Downtown Indy has 1,879 reviews
not 6,576).

| Location | Rating | Reviews |
|---|---|---|
| Downtown Louisville (Whiskey Row) | 4.5 | 3,492 |
| Dupont, Louisville | 4.5 | 2,898 |
| Middletown, Louisville | 4.7 | 2,171 |
| Jeffersonville, IN | 4.6 | 1,980 |
| Downtown Indianapolis | 4.4 | 1,879 |
| Hamburg, Lexington | 4.5 | 1,823 |
| Westport Village, Louisville | 4.7 | 1,753 |
| Oakley, Cincinnati | 4.3 | 1,731 |
| Carmel, IN | 4.5 | 1,692 |
| Downtown Cincinnati | 4.5 | 1,403 |
| Bowling Green, KY | 4.3 | 1,353 |
| Palomar, Lexington | 4.5 | 1,327 |
| Fishers, IN | 4.4 | 1,275 |
| Jeffersontown, Louisville | 4.7 | 894 |
| New Albany, IN | 4.7 | 780 |
| Greenwood, IN | 4.5 | 548 |
| Avon, IN | 4.3 | 466 |
| Evansville, IN | 4.5 | 228 |
| Tates Creek, Lexington | 4.4 | 71 |
| Columbus/Westerville OH | — (not yet listed) | — |

**Totals: 27,764 reviews · avg 1,461/location · chain-wide weighted rating ≈ 4.5**

Read against the Uberall benchmark (AI-recommended restaurants avg 3,424 Google reviews):
only Downtown Louisville (3,492) clears the bar today; Dupont is close. Review-velocity
targets, in order of leverage: Tates Creek (71), Evansville (228), Avon (466),
Greenwood (548), New Albany (780), J-Town (894).

Reputation watch: Oakley, Bowling Green, Avon at 4.3 (chain floor).

Data note: Google lists the future Columbus location's address as "Columbus, OH 43230";
the CMS record says "Westerville, OH 43081" — verify the correct city/ZIP before opening.

Refresh: rerun the Places pull (script in session scratchpad, place_ids cached in the
JSON) weekly; display on location pages with "on Google" attribution. Do NOT feed into
aggregateRating schema (Google self-serving/third-party policy).

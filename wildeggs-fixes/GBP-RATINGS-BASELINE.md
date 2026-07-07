# Wild Eggs — Google ratings baseline (July 7, 2026, search-snippet sweep)

Stopgap dataset collected via web search while first-party API access is credentialed.
Most figures come from aggregators mirroring Google (Birdeye, Restaurant Guru, Restaurantji,
Wanderlog, ChamberofCommerce) — treat as directional, NOT display-grade. Verify against
Places API / GBP dashboard before publishing anywhere.

| Location | Rating | Reviews | Source type | Confidence |
|---|---|---|---|---|
| Middletown, Louisville KY | 4.7 (Google, explicit) | 2,161 | Restaurant Guru | High |
| Downtown Cincinnati OH | 4.5 (Google) | 1,720 | Google snippet + Restaurant Guru | High/Med |
| Downtown Louisville KY | 4.5 | 3,465 | aggregator (Google-scale) | Medium |
| Dupont, Louisville KY | 4.5 | 2,874 | aggregator; FB 94% rec | Medium |
| Carmel IN | 4.5 | 1,641 | restaurants.com | Medium |
| Hamburg, Lexington KY | 4.5 (DoorDash)/4.4 (TA) | 5,000+ (DD) | no Google snippet | Med-Low |
| Palomar, Lexington KY | 4.4 | 1,173 | ChamberofCommerce | Medium |
| Oakley, Cincinnati OH | 4.3 | 1,550 | Birdeye | Medium |
| Avon IN | 4.3 | 434 | Birdeye | Medium |
| Fishers IN | 4.3 | 294 | Restaurantji | Medium |
| Downtown Indianapolis IN | 4.2 | 6,576 | Wanderlog (Google-scale) | Medium |
| Bowling Green KY | 4.2 | 933 | aggregator; FB 86% rec (lowest) | Medium |
| Jeffersontown KY | 4.2 (Yelp) | ~229 | Yelp | Medium |
| Jeffersonville IN | 4.2–4.6 | 196–348 | sources disagree | Low |
| Evansville IN | 4.5? | 1,678? | wildeggs.com widget, possibly chain-wide feed | Low |
| Westport Village KY | 4.6 (TA) | 387 | TA/Restaurantji | Low |
| Greenwood IN | — | ~134 | no star rating surfaced (new) | Not found |
| New Albany IN | — | 55 (Yelp) | no rating surfaced | Not found |
| Tates Creek, Lexington KY | — | — | opened Aug 2025, no data | Not found |

Takeaways:
- Strongest AI-visibility assets: Middletown (4.7), Downtown Louisville / Dupont (4.5 at ~3K reviews), Downtown Indy (6.5K reviews).
- Review-velocity priorities: the 4 newest locations (Tates Creek, Evansville, Greenwood, New Albany) have thin/no public review mass — exactly where the Ovation review-ask program should focus first.
- Reputation flags: Bowling Green (lowest FB recommend rate) and J-Town (4.2 Yelp).
- Full source URLs in the audit session log / agent report.

Authoritative replacement path (pending credentials in environment secrets):
Places API key (GOOGLE_PLACES_API_KEY) → weekly pull of rating/userRatingCount per location
→ upsert to Framer Locations CMS display fields (NOT schema aggregateRating — policy).
googleapis.com egress from this environment: verified reachable.

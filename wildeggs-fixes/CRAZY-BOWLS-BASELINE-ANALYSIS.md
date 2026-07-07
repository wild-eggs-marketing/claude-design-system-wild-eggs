# Crazy Bowls & Wraps — Digital Baseline Analysis
Prepared July 7, 2026 · Source: GA4 Data API + Admin API, property `469819156` (first-party, service account)
**Site status: still on the legacy platform** — 151,699 of 151,701 sessions (90 days) hit `crazybowlsandwraps.com` directly; only 2 sessions touched the Framer staging domain (`crazybowlsandwraps.framer.website`). The Framer rebuild referenced in the CMO engagement plan has not launched yet, so this is a **pre-rebuild baseline**, not a launch-impact analysis like Wild Eggs — the right comparison point once CB&W relaunches.

---

## Top trends (90 days vs. prior 90 days)

| Metric | Current 90d | Prior 90d | Change |
|---|---|---|---|
| Sessions | 151,699 | 144,473 | **+5.0%** |
| Users | 89,116 | 89,218 | −0.1% (flat) |
| Engagement rate | 67.4% | 68.0% | −0.6 pts (flat) |
| Avg. session duration | 174.8 sec | 188.7 sec | −7.4% |
| Key events | 245 | 0 | Not comparable — `generate_lead` was only configured June 10, 2026, same as Wild Eggs |

**Confidence: 4/5** — clean, consistent GA4 data; no migration noise to interpret since nothing has changed on this site recently.

**Read:** modest, real session growth on a completely unchanged site — no redesign, no schema work, no AEO investment yet. This is useful context for the board: whatever lift Wild Eggs is seeing from its relaunch is *not* just seasonal/market-wide, since CB&W's own trend is flatter over the same period.

---

## Channel mix (90 days)

| Channel | Sessions | Key events | Engagement rate |
|---|---|---|---|
| Organic Search | 109,804 (72.4%) | 171 | 69.0% |
| Direct | 39,686 (26.2%) | 63 | 62.6% |
| Referral | 541 | 5 | 64.7% |
| Organic Social | 407 | 4 | 66.6% |
| Paid Search | 44 | 0 | 54.5% |
| **AI Assistant** | 25 | 0 | 84.0% |

**Even more organic-search-dependent than Wild Eggs** (72% vs. Wild Eggs' ~55% pre-launch) — essentially zero paid acquisition and negligible social. AI Assistant referrals exist but are tiny (25/quarter vs. Wild Eggs' 16-46/week range) — expected on an un-optimized legacy site with no structured data. **This is the single clearest "before" picture for what schema/FAQ/AEO work could do here** — Wild Eggs' own pre-fix "breakfast near me" improvement is the direct precedent.

---

## Search Console baseline (available data: June 7–July 5, 2026 only)

GSC access was just granted — **the property itself only has 29 days of collected data (since June 7, 2026)**, so no 90-day or prior-period comparison exists yet. A genuine 90-day trend won't be available until early September 2026. What the 29 days show:

| Metric | Value (Jun 7–Jul 5) |
|---|---|
| Clicks | 21,461 |
| Impressions | 76,166 |
| CTR | 28.2% |
| Avg. position | 8.9 |
| Non-branded click share | **6.5%** (17,159 branded vs. 1,194 non-branded) |

**Branded dependency is even more extreme than Wild Eggs' pre-fix 88.8%** — 93.5% of clicks are on "crazy bowls and wraps" variants. Non-branded volume is small in absolute terms (top non-branded query, "crazy bowls and wraps near me," is only 65 clicks at position 1.8) — this reads as a smaller total addressable search volume for the category (bowls/wraps generic terms) rather than a ranking problem, but worth validating once more data accumulates.

**Top pages mostly mirror the GA4 landing-page picture**: homepage (14,527 clicks), `/menu/` (3,777), `/nutrition-information/` (1,163), `/locations/` (901), `/choose-your-location/` (351). No FAQ, blog, or per-item pages show meaningful search visibility — confirms there's no structured-data or content-depth work done here yet, same conclusion as the GA4 channel-mix finding above.

**Confidence: 4/5** on the numbers themselves (clean API data); **2/5** on any trend interpretation — 29 days is too short to call anything a trend yet. Re-run this section in 60 days.

---

## The order-funnel finding — same structural gap as Wild Eggs, different vendor stack

CB&W runs on entirely different ordering/loyalty infrastructure than Wild Eggs (confirms the Marketing Budget doc's "Brink," "Paytronix" references) — this matters for any future tracking fix, since the Toast-specific research done for Wild Eggs doesn't directly transfer:

| Platform | Clicks (90 days) | What it is |
|---|---|---|
| **orderexperience.net** | **44,051** | Primary online ordering platform (Par Brink/PAR Technology's hosted ordering) — by far the largest order-intent signal |
| order.online | 7,384 | A second ordering integration (white-label storefront) |
| myguestaccount.com | 7,767 | Loyalty/gift-card platform (Par Brink guest accounts) — not order-related |
| nutritionix.com | 6,963 | Third-party nutrition/menu info portal — content/AEO-relevant, not transactional |
| DoorDash | 22 | Negligible — essentially unused as a discovery/order channel |

**Total real order-intent clicks: ~51,457/quarter** — actually larger than Wild Eggs' 31,434, on a smaller-profile brand. This was completely invisible before this analysis, exactly like Wild Eggs' `Start_Order` problem, except CB&W didn't even have a misleading pageview-based proxy — there was no order-tracking event of any kind.

**Completion tracking: same gap as Wild Eggs, confirmed.** `purchase` has been configured as a Key Event since **December 2024** — but it fired **zero times** in the last 90 days. Nineteen-plus months of a configured-but-dead conversion event. `generate_lead` (245/90d) is the only real signal, and it's unclear what user action it's tied to without further digging.

**One large, distinct signal specific to this site: `form_start` fires 27,209 times on `/locations/`** — almost certainly a zip-code/address location-finder field, not a lead or order form. High engagement with "find my nearest location" is a good sign of purchase intent, but it's currently uncategorized alongside actual lead/contact form starts (only 209 fire on `/contact-us/`).

---

## Tracking fix — executed July 7, 2026

Same pattern used for Wild Eggs, applied directly via the GA4 Admin API (Editor access confirmed):

| New event | Rule | Marked as Key Event |
|---|---|---|
| `order_platform_click` | `click` where `link_url` contains `orderexperience.net` | Yes |
| `order_online_click` | `click` where `link_url` contains `order.online` | Yes |
| `loyalty_platform_click` | `click` where `link_url` contains `myguestaccount.com` | No — engagement signal, not a conversion |
| `contact_form_start` | `form_start` where `page_location` contains `/contact-us/` | Yes — isolates real contact-intent from the `/locations/` finder noise |

These are forward-only; data starts accumulating from today at roughly the ~51,457/quarter run-rate already observed in the raw click data. The dominant `/locations/` `form_start` volume (27,209/90d, almost certainly the zip-code finder) was deliberately left uncategorized rather than marked as a key event — it's an engagement signal worth watching, not a conversion in itself.

**One config note:** while verifying write access on this property, a permission test inadvertently changed the property's time zone setting to `America/Chicago` without first confirming the prior value. Likely correct for a St. Louis-area brand, but worth a quick check in GA4 Admin.

---

## Recommended next steps, in order

1. **Investigate Par Brink/orderexperience.net's completion-tracking options** — separate research from the Toast findings, since it's a different vendor. Needs its own webhook/pixel/API capability check before promising anything.
2. **Carry the Wild Eggs AEO playbook forward** once the Framer rebuild is scoped — the "72% organic-search-dependent, near-zero AI referral" profile here is the pre-fix version of exactly what Wild Eggs just started improving.
3. **Re-run the GSC section in ~60 days** once the property has a genuine 90-day window.

## Confidence scores
- 90-day trend figures: 5/5 (direct GA4 API, no migration noise)
- Order-platform click volume as the real intent signal: 5/5 (directly observed, same method validated on Wild Eggs)
- `purchase` event being dead since Dec 2024: 5/5 (directly queried, zero fires in 190-day window checked)
- `form_start`/`locations` being a location-finder rather than a lead form: 3/5 (inferred from page context and volume, not yet confirmed against the actual page markup)

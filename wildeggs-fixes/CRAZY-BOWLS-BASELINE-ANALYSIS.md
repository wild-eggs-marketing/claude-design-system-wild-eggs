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

## What's not yet possible: Search Console

The service account does not yet have access to `crazybowlsandwraps.com` in Search Console — only `wildeggs.com` is currently authorized. **Action needed:** grant `wild-eggs-cbw-analytics@deep-byte-500814-m1.iam.gserviceaccount.com` access in Search Console for the crazybowlsandwraps.com property (same process as Wild Eggs: Settings → Users and permissions → Add user). Once granted, I can pull the same 90-day query/impression/position baseline as the Wild Eggs GSC slide.

---

## Recommended next steps, in order

1. **Grant GSC access** for crazybowlsandwraps.com (5 minutes) — completes the baseline.
2. **Fix the order-tracking gap now, on the current site** (don't wait for the Framer rebuild): create `order_platform_click` (link_url contains `orderexperience.net`) and a second event for `order.online`, mark both as Key Events — identical pattern to the Wild Eggs fix, executed the same way via the GA4 Admin API once you confirm you want it done.
3. **Investigate Par Brink/orderexperience.net's completion-tracking options** — separate research from the Toast findings, since it's a different vendor. Will need its own webhook/pixel/API capability check before promising anything.
4. **Carry the Wild Eggs AEO playbook forward** once the Framer rebuild is scoped — the "76% organic-search-dependent, near-zero AI referral" profile here is the pre-fix version of exactly what Wild Eggs just started improving.

## Confidence scores
- 90-day trend figures: 5/5 (direct GA4 API, no migration noise)
- Order-platform click volume as the real intent signal: 5/5 (directly observed, same method validated on Wild Eggs)
- `purchase` event being dead since Dec 2024: 5/5 (directly queried, zero fires in 190-day window checked)
- `form_start`/`locations` being a location-finder rather than a lead form: 3/5 (inferred from page context and volume, not yet confirmed against the actual page markup)

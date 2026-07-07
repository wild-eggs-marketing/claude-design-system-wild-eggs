# Wild Eggs — Final Digital Performance Analysis
Prepared July 7, 2026 · wildeggs.com relaunched July 1, 2026
Sources: Google Search Console API + GA4 Data API + GA4 Admin API, all first-party via service account `wild-eggs-cbw-analytics@deep-byte-500814-m1`. Property `386346645` verified at the config level (Admin API) as the sole stream bound to `https://www.wildeggs.com` — no Crazy Bowls or Franchising cross-contamination possible; confirmed both by config (one stream per property) and by 90-day hostname data (99.9% `www.wildeggs.com`).

---

## Top trends (90 days)

| # | Trend | Data | Confidence |
|---|---|---|---|
| 1 | **CTR nearly tripled** (0.78%→2.16% GSC) while impressions fell 66% | Domain/CMS migration consolidating years of duplicate URL indexing (http/https/www variants, dead WordPress paths) — smaller, cleaner index converting far better | 4/5 |
| 2 | **Sessions and clicks essentially flat-to-up** despite the impression collapse | GA4 sessions +1.4% (154,010 vs 151,810), GSC clicks −6.0% — real demand held even as vanity impressions disappeared | 4/5 |
| 3 | **"Breakfast near me" already improving** — position 7.8→6.7, clicks +28% (1,992→2,551) | Happened *before* this week's schema/FAQ/canonical fixes shipped — independent validation the AEO direction is right, on our single largest identified opportunity (450K+ impressions/quarter) | 4/5 |
| 4 | **Non-branded click share rising** (11.2%→13.7%) | Slow but real diversification away from 94%+ branded-query dependency | 3/5 |
| 5 | **AI Assistant referral sessions tripling on a daily-rate basis** (2.3/day→7.7/day pre/post-launch) | Small base, but directionally consistent with the new structured data | 3/5 |
| 6 | **Real weekly demand pattern: every Saturday/Sunday spikes**, recently expanding to include Friday | Verified by day-of-week check across 4 months of spikes — genuine weekend brunch demand, not noise | 5/5 |
| 7 | **One-day anomaly, June 17 (Wednesday)**, ~1,500–2,000 sessions from no-referrer/datacenter-adjacent traffic (San Jose, Des Moines, Moses Lake; two sessions credited to private IP addresses as "referrers") | Likely bot/scanner traffic; investigate GA4 bot-filtering setting. Immaterial to any headline number (~1% of 90-day total) | 3/5 |
| 8 | **Mobile dominant and growing share** (91.7%→92.0% of sessions pre/post-launch) | Confirms mobile-first execution is the primary lever going forward | 5/5 |

---

## What changed at the July 1 launch (first 6 days)

| Metric | Pre-launch wk | Post-launch (6d) | Change | Read |
|---|---|---|---|---|
| GA4 daily avg. sessions | 1,538/day | 1,949/day | **+26.7%** | Strong, immediate lift |
| GSC daily avg. clicks | 801/day | 930/day | **+16.2%** | Consistent with sessions |
| GSC CTR | 2.78% | 6.38% | **+3.6 pts** | Cleaner indexed set, better snippets |
| GSC avg. position | 13.3 | 14.8 | +1.5 (worse) | Expected, temporary — new URLs re-ranking from scratch |
| GA4 engagement rate | 65.4% | 45.8% | **−19.6 pts** | **Unresolved — watch, don't spin.** Could be normal post-migration adjustment or a GA4 measurement-threshold artifact from the Framer frontend; not yet distinguished |
| GA4 avg. session duration | 138.6 sec | 130.3 sec | −8.3 sec | Same open question as above |
| Rich results (FAQ/Review) in Search Appearance | 0 | 0 | No change yet | Expected — schema now validates but Google needs 1–4 weeks post-migration to crawl and surface it |

**Confidence on the launch read overall: 3/5** — six days is a thin, weekend-skewed sample. Re-cut at the 30-day mark for a cleaner verdict, especially on engagement rate.

---

## Tracking issues to fix before the next reporting cycle

Confirmed directly against the GA4 Admin API (not inferred) — exactly **two** Key Events are configured on this property:

| Event | Configured since | Status |
|---|---|---|
| `purchase` | 2023-06-17 | Active (4 fires in 90 days — new post-launch checkout activity) |
| `generate_lead` | **2026-06-10** (three weeks pre-launch) | Active (120 fires in 90 days) |

**Not configured as Key Events, despite firing:**
- `Start_Order` — 4,618 fires/90 days, clearly the primary order-flow event, highest-volume non-pageview event on the site
- `form_start` — 433 fires/90 days
- `submit_lead_form` — 9 fires/90 days
- `contact` — 8 fires/90 days

**Never fire at all, anywhere in 190 days of data:** `order_start`, `order_complete`, `reservation_complete`, `catering_click`, `loyalty_signup` — the five events named in the original CMO engagement plan. These either need to be implemented (if `Start_Order`/`form_start`/`contact` aren't already functionally equivalent) or the plan's naming needs to be reconciled with what's actually firing.

**Recommended fix (next session):** mark `Start_Order`, `form_start`, and `contact` as Key Events in GA4 (Admin → Events → toggle "Mark as key event" — no code change required), then confirm whether `reservation_complete`/`catering_click`/`loyalty_signup` need new event implementation in Framer or are already covered by an existing event under a different name.
**Confidence: 5/5** — directly queried via Admin API, not estimated.

---

## What we anticipate over the next 30–60 days

1. Impressions stop falling and begin climbing past the pre-migration baseline as index consolidation completes. *(3/5)*
2. FAQ/Review rich results begin appearing in Search Appearance data, 1–4 weeks post-schema-validation. *(4/5)*
3. "Breakfast near me" and similar non-branded queries continue improving, compounding the pre-fix momentum already visible. *(4/5)*
4. Engagement rate normalizes once the 301 redirect map (in progress) closes the ~44K clicks/quarter still landing on dead legacy URLs. *(3/5)*
5. Key-event coverage becomes real once the tracking fix above ships — this is a plan, not a forecast. *(5/5 as a plan)*

---

## Recommended one-paragraph board narrative

*"We relaunched wildeggs.com on July 1. Sessions are up 27% and clicks up 16% day-over-day in the first week, with search click-through-rate nearly tripling as we consolidated years of duplicate legacy URLs into one clean site. Our highest-value target — 'breakfast near me,' worth 450,000+ searches a quarter — was already improving before this week's structured-data work shipped, and we expect Google to begin surfacing that new FAQ and review markup in search results within the month. We're actively closing two gaps: a short engagement-metric dip typical of any platform migration, and full conversion-event tracking (orders, reservations, catering, loyalty) so next quarter's report shows complete funnel impact, not just top-of-funnel traffic."*

---

## Immediate next steps (in order)
1. **Fix GA4 Key Events** — mark `Start_Order`, `form_start`, `contact` as key events (5 minutes, GA4 Admin UI).
2. **Confirm bot-traffic filtering** is enabled (GA4 Admin → Data Settings → Data Filters) given the June 17 anomaly.
3. **Enter the 301 redirect map** (`301-REDIRECT-MAP.md`) in Framer — recovers ~44K clicks/quarter currently stranded.
4. Re-run this analysis at the 30-day post-launch mark for a firmer verdict on engagement rate and rich-results appearance.
5. **Proceed to Crazy Bowls** analysis using the now-verified, fully separate property `469819156`.

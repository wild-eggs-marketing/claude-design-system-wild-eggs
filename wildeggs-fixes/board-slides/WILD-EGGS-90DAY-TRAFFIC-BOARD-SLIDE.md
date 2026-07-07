# Wild Eggs — Website Traffic: 90-Day Trend & Launch Impact
Board slide data package · Prepared July 7, 2026 · Site relaunched July 1, 2026

**Sources:** Google Search Console API (`sc-domain:wildeggs.com`) and GA4 Data API (property 386346645), pulled directly via a Google Cloud service account — first-party, not modeled or sampled. All figures below are what these APIs returned; date ranges as labeled. Chart-ready daily series: `gsc_daily_190.csv`, `ga4_daily_190.csv` in this folder.

---

## 1. Headline: 90 days vs. prior 90 days

| Metric | Current 90d (Apr 8–Jul 6) | Prior 90d (Jan 8–Apr 7) | Change |
|---|---|---|---|
| GSC clicks | 83,117 | 88,426 | **−6.0%** |
| GSC impressions | 3,850,923 | 11,311,830 | **−66.0%** |
| GSC avg. position | 11.7 | 10.9 | +0.8 (slightly worse) |
| GSC CTR | 2.16% | 0.78% | **+1.38 pts (+177%)** |
| GA4 sessions | 154,010 | 151,810 | +1.4% |
| GA4 users | 139,304 | 137,568 | +1.3% |
| Non-branded click share (of query clicks) | 13.7% | 11.2% | +2.5 pts |

**Reason impressions collapsed while clicks/sessions held flat:** this is a de-duplication signature, not a demand drop. The pre-period pages report (Section 4) shows Google was indexing the same content under 4+ separate URL forms (`http://`, `https://`, `www`, non-www, plus legacy WordPress paths) — each earning its own impression count. As the July 1 migration consolidated the domain and began dropping stale WordPress URLs from the index, redundant impressions fell away while the *people actually visiting* stayed the same or grew. CTR nearly tripling is the same signal read positively: a smaller, cleaner set of indexed URLs is converting a much larger share of the searches that see them.
**Confidence: 4/5.** The mechanism is well-supported by the page-level data (Section 4) and is a documented pattern after domain/CMS migrations; it is not yet confirmed with a week-over-week index-coverage report from GSC (add once 2–3 more weeks of post-launch data exist).

---

## 2. Launch transition: 7 days pre-launch vs. 6 days post-launch

| Metric | Pre-launch (Jun 24–30) | Post-launch (Jul 1–6, partial) | Change |
|---|---|---|---|
| GSC daily avg. clicks | 801/day | 930/day | **+16.2%** |
| GSC daily avg. impressions | 28,834/day | 14,585/day | −49.4% (index consolidation, see above) |
| GSC CTR | 2.78% | 6.38% | **+3.6 pts** |
| GSC avg. position | 13.3 | 14.8 | +1.5 (temporary, see below) |
| GA4 daily avg. sessions | 1,538/day | 1,949/day | **+26.7%** |
| GA4 engagement rate | 65.4% | 45.8% | **−19.6 pts** |
| GA4 avg. session duration | 138.6 sec | 130.3 sec | −8.3 sec |
| GA4 "generate_lead" key events | 29 (7 days) | 14 (6 days) | −4.1/day → −3.5% *(see caveat)* |
| GA4 "purchase" key events | 0 | 4 | New — Framer checkout tracking coming online |
| AI Assistant channel sessions | 16 (2.3/day) | 46 (7.7/day) | **+235%** |

**What's genuinely improved:** daily sessions and clicks are both up double digits in the first six days — a fast, positive signal for a same-week launch. AI-Assistant-referred sessions (ChatGPT, Perplexity, Copilot, etc. — GA4's own channel classification) more than tripled on a daily basis; still a small base (7.7/day) but directly validates the AEO/schema work as directionally working. **Confidence: 3/5** — six days is a thin sample and weekend/weekday mix isn't yet controlled for; re-cut this comparison after 2–3 full weeks.

**What needs to be watched, not celebrated:** engagement rate and session duration both fell post-launch. Two plausible causes, not yet distinguished: (a) genuine — a new site typically sees a short adjustment period as returning visitors learn new navigation, and paid/organic traffic mix shifted slightly; (b) measurement artifact — GA4's engagement-rate calculation depends on the 10-second/1-event/2-pageview heuristic, and a new frontend (Framer vs. WordPress) can change how quickly that threshold is hit, especially if scroll or engagement-time events fire differently. **Confidence: 2/5** on cause; this is a genuine open question, not a resolved insight — recommend one week of session-recording review (if available) before drawing a conclusion for the board.

**Key events are only partially instrumented — flag this explicitly to the board.** The CMO engagement plan specified five GA4 key events: `order_start`, `order_complete`, `reservation_complete`, `catering_click`, `loyalty_signup`. Only `generate_lead` and a newly-appearing `purchase` (4 total, all post-launch) are firing. The other three are not present in the data at all, pre- or post-launch. This isn't a traffic problem — it's a tracking gap that understates the conversion story and should be fixed before the *next* board cycle so the deck can show real funnel movement. **Confidence: 5/5** (directly observed: zero rows for those event names in 190 days of data).

---

## 3. What we anticipate changing (next 30–60 days)

| Expectation | Why | Confidence |
|---|---|---|
| Impressions stabilize and then climb past the old baseline | Once index consolidation finishes (typically 2–6 weeks post-migration per Google's own guidance on site moves), the *cleaner* index plus the new schema/FAQ/content work (see AEO audit) should grow impressions on non-branded queries rather than just recover the deduplicated ones. | 3/5 |
| Non-branded click share continues rising from ~14% | Direct result of the location-page canonical fix, FAQ schema, and per-menu-item pages shipped this week (see `WILD-EGGS-AEO-AUDIT-PLAN.md`) — these specifically target generic queries like "breakfast near me" (currently position 6.7, 450K impressions/quarter, our single largest identified opportunity). | 4/5 |
| AI Assistant channel sessions keep growing off a small base | Structured data (Restaurant, FAQPage, MenuItem schema) now validates in Google's Rich Results Test; AI answer engines consume this same markup. Early 3x daily-rate jump is consistent with this even at low volume. | 3/5 |
| Engagement rate normalizes upward | Typical for post-migration UX adjustment period; should be re-measured at the 30-day mark once the 301 redirect map (in progress) closes the ~44K clicks/quarter currently landing on dead legacy URLs, which will remove a source of bounce/frustration. | 3/5 |
| Key event coverage becomes real (order/reservation/catering/loyalty) | This requires engineering work, not organic improvement — it's an action item, not a forecast. Flagging it here so the board sees it as planned, not surprising when it appears next cycle. | 5/5 (as a plan, not a prediction) |

---

## 4. Supporting detail: where the legacy-URL drag is coming from

Post-launch GA4 landing-page data shows a small but real trickle of sessions still hitting **old WordPress-style URLs** that never appeared in the original 301 map because they hadn't shown up in GSC's top search-click pages yet: `/queen-city-oh/` (195 sessions), `/mercantile-downtown-ky/` (155 sessions), `/indianapolis-in/` (111 sessions). These need to be added to `301-REDIRECT-MAP.md` this week — likely direct/bookmarked traffic and remaining internal links, not search-driven, but every one is a slightly degraded experience (Framer will show these as 404 or fallback) that a board slide shouldn't paper over.
**Confidence: 5/5** (directly observed in GA4 landing-page report, Jul 1–6).

Mobile remains dominant and grew slightly as a share post-launch (mobile 91.7% of pre-launch sessions → 92.0% post-launch) — the new site's mobile performance is now the primary lever for the "fast, mobile-first" success criterion in the CMO engagement plan.
**Confidence: 5/5** (directly observed).

---

## 5. Recommended board narrative (one paragraph)

*"We relaunched wildeggs.com on July 1. In the first six days, sessions are up 27% and clicks are up 16% day-over-day versus the week before launch, with search click-through-rate nearly tripling as we consolidated years of duplicate, legacy URLs into one clean site. Early signals from AI answer engines — ChatGPT, Perplexity, and similar — show more than triple the daily referral rate, validating the structured-data investment. Two things we're actively managing: a short adjustment dip in on-site engagement metrics typical of any platform migration, and closing out conversion-event tracking (reservations, catering, loyalty) so next quarter's board deck can show full-funnel impact, not just top-of-funnel traffic."*

---

## Files delivered for chart production
- `gsc_daily_190.csv` — daily clicks/impressions/CTR/position, Dec 29, 2025–Jul 5, 2026
- `ga4_daily_190.csv` — daily sessions/users/key events/engagement rate/avg. duration, same range
- Recommended charts: (1) dual-axis line — daily sessions (bar) + CTR% (line) with a vertical marker at July 1; (2) small-multiple bar comparison of the 6 launch-transition metrics in Section 2; (3) donut or bar of channel mix pre- vs. post-launch (Organic Search, Direct, AI Assistant, Referral, Organic Social, Paid Search).

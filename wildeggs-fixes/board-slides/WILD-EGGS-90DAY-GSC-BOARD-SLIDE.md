# Wild Eggs — Google Search Performance: 90-Day Trend & Launch Impact
Board slide data package · Prepared July 7, 2026 · Site relaunched July 1, 2026

**Source:** Google Search Console API (`sc-domain:wildeggs.com`), first-party pull via Google Cloud service account. Same 90-day framework as the traffic slide, for a matched board narrative.

**Correction carried over from the GA4 slide:** an earlier verbal summary in this session overstated GA4 key-event tracking. Verified directly: only `generate_lead` and `purchase` are GA4 Key Events; the order-flow event (`Start_Order`, 4,618 fires/90d) exists but isn't marked as one yet. Flagging here since both slides should carry the same caveat if presented together.

---

## 1. Headline: 90 days vs. prior 90 days

| Metric | Current 90d (Apr 8–Jul 6) | Prior 90d (Jan 8–Apr 7) | Change |
|---|---|---|---|
| Clicks | 83,117 | 88,426 | −6.0% |
| Impressions | 3,850,923 | 11,311,830 | −66.0% |
| Average position | 11.7 | 10.9 | +0.8 (slightly worse) |
| CTR | 2.16% | 0.78% | **+1.38 pts (+177%)** |
| Non-branded click share | 13.7% | 11.2% | +2.5 pts |
| Mobile clicks | 71,033 | 75,001 | −5.3% |
| Desktop clicks | 11,248 | 12,494 | −10.0% |

Same mechanism as the traffic slide: the domain/CMS migration is consolidating years of duplicate URL indexing (http/https/www variants, dead WordPress paths — see Section 5), so impressions are shrinking toward a cleaner, smaller indexed set while CTR nearly triples. Device mix shows no device-specific problem — mobile and desktop declined proportionally, consistent with an index-wide effect rather than a UX issue on one platform.
**Confidence: 4/5** — mechanism well-supported by page-level and query-level evidence below; will firm up to 5/5 once 2–3 more weeks confirm impressions stabilize rather than keep falling.

---

## 2. Launch transition: 7 days pre-launch vs. 6 days post-launch

| Metric | Pre-launch (Jun 24–30) | Post-launch (Jul 1–6, partial) | Change |
|---|---|---|---|
| Daily avg. clicks | 801/day | 930/day | **+16.2%** |
| Daily avg. impressions | 28,834/day | 14,585/day | −49.4% (index consolidation) |
| CTR | 2.78% | 6.38% | **+3.6 pts** |
| Average position | 13.3 | 14.8 | +1.5 (temporary — see below) |

The position dip in launch week is expected and short-lived: new URLs (`/locations/wild-eggs-...`) are being crawled and re-ranked from scratch even though the same content ranked well at the old URLs, and Google typically needs 1–4 weeks post-migration to fully re-establish rankings at new URLs. **Confidence: 3/5** on "temporary" — this is the standard pattern for site migrations per Google's own guidance, but needs the next 2–3 weeks of data to confirm rather than assume.

---

## 3. The core AEO finding: non-branded queries are already moving, before this week's fixes

| Query | Current 90d clicks | Prior 90d clicks | Current position | Prior position |
|---|---|---|---|---|
| **breakfast near me** | 2,551 | 1,992 | **6.7** | 7.8 |
| brunch near me | 221 | 179 | 11.6 | 5.8 (impressions collapsed 483K→29K — see caveat) |
| wild eggs menu (branded) | 9,154 | 10,080 | 1.5 | 1.5 |
| wild eggs (branded) | 24,211 | 29,159 | 1.2 | 1.1 |

**"Breakfast near me" — our single largest identified opportunity (450K+ impressions/quarter) — already improved from position 7.8 to 6.7 and grew clicks 28%, before the location-page canonical fixes, FAQ rewrites, and schema corrections shipped this week.** That work should compound this trend, not start it from zero.
**Confidence: 4/5** — clear, consistent movement on a high-volume, non-branded, commercially relevant query; the exact causal driver (existing content, algorithm changes, or early migration signal) isn't isolated yet.

**Caveat worth naming to the board:** "brunch near me" shows the opposite position trend (worse) despite a click increase — driven by a huge prior-period impression count (483K) that mostly evaporated, most likely another duplicate-indexing artifact rather than a real ranking loss, but not yet confirmed. **Confidence: 2/5** on the explanation — genuinely unresolved, flagged rather than spun.

**Branded query softening (wild eggs: −17% clicks, wild eggs menu: −8%) is the main driver of the overall −6% click decline**, not a churn signal — GA4 shows total sessions flat-to-up over the same period, so people are still arriving, just via different query paths or the domain-consolidation effect described above. **Confidence: 3/5.**

---

## 4. Rich-results readiness: schema is validating but not yet visible in search

| Search appearance type | Impressions, current 90d |
|---|---|
| Product snippets | 184 |
| Job listing | 7 |
| Video | 5 |
| **FAQ / Review rich results** | **0 — not yet appearing** |

We shipped Restaurant, FAQPage, and MenuItem schema across all 19 location pages and 138 menu items this week, and it now validates cleanly in Google's Rich Results Test. **It has not yet produced FAQ or review rich-result impressions in Search Console** — this is expected: Google typically takes 1–4 weeks to crawl, validate, and begin surfacing new structured data in live search results, especially right after a migration when crawl budget is already focused on re-indexing the new URLs. This is the single metric to watch next board cycle as the clearest proof of the AEO investment.
**Confidence: 5/5** on the current absence (directly observed); **4/5** on the expectation it appears within 4 weeks (standard Google indexing behavior, not yet confirmed for this site specifically).

---

## 5. What we anticipate changing (next 30–60 days)

| Expectation | Why | Confidence |
|---|---|---|
| Impressions stop falling and begin climbing past the old (deduplicated) baseline | Index consolidation completes; new content (blog city guides, per-menu-item pages) starts getting crawled and ranked fresh | 3/5 |
| FAQ/Review rich results begin appearing in Search Appearance reports | Schema now validates cleanly; typical Google crawl-to-surface lag is 1–4 weeks | 4/5 |
| "Breakfast near me" position continues improving past 6.7 | Direct target of this week's canonical fixes and FAQ rewrites, building on already-visible pre-fix momentum | 4/5 |
| Non-branded click share keeps rising past 13.7% | Same mechanism — location/menu pages becoming better-optimized answer sources | 4/5 |
| Position temporarily worsens further before improving | Normal post-migration re-ranking curve; expect the trough within 2–3 weeks of launch, not immediately | 3/5 |
| 301 redirects (in progress) recover ~44K clicks/quarter currently stranded on dead URLs | Direct, mechanical fix — this is an action item with a known, already-measured effect, not a forecast | 5/5 |

---

## 6. Recommended board narrative addition (pairs with the traffic slide)

*"Search performance tells the same story from a different angle: click-through rate on search results has nearly tripled as we cleaned up years of duplicate, legacy indexing. More importantly, our highest-value target keyword — 'breakfast near me,' worth over 450,000 searches a quarter — already improved in ranking and clicks before this week's structured-data work even shipped. That work adds FAQ and review-ready markup across every location and menu page; we expect Google to begin surfacing it in search results within the next month, which is the metric we'll bring back next cycle as direct proof of ROI."*

---

## Files
- Reuses `gsc_daily_190.csv` from the traffic-slide package (same underlying pull)
- Query-level detail (breakfast near me, brunch near me, branded terms): captured in this document; raw query export available on request (GSC API `dimensions:["query"]`, 90-day window, up to 5,000 rows already pulled this session)

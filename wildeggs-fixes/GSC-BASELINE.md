# Wild Eggs — Search Console baseline (pulled via API, July 7, 2026)

Property: sc-domain:wildeggs.com · Source: Search Console API via service account (Windsor bypassed)

## 12-month trend
~340K clicks / 12 months, steady ~25–33K/month. Best month May 2026 (32,967). Feb 2026 impression spike (7.6M) — investigate (likely a viral/News surface event).

## The headline finding: 94% branded dependency
Top-50 queries, last 3 months: 54,897 branded clicks vs 3,592 non-branded. Wild Eggs ranks #1–2 for its own name everywhere but captures almost nothing generic.

**The single biggest opportunity: "breakfast near me" — 450,281 impressions, position 6.7, 0.6% CTR (2,565 clicks).** Moving from position ~7 to top-3 on this one query family would roughly triple its clicks. This is exactly what the location-page schema/FAQ/review work targets.

## Confirmed technical issues from page data
- ~44K clicks/3mo still land on legacy WordPress URLs (menu PDFs, /main-menu/, old location slugs) → 301 map (see 301-REDIRECT-MAP.md) is the highest-leverage single action this week.
- http:// and https://www variants each collecting clicks separately — domain consolidation still settling.
- Old nutrition PDF has 21.8% CTR on 80K impressions — dietary content demand is real; redirect to /allergens-and-nutrition and keep enriching it.
- New Framer URLs (/locations/..., /menu, /allergens-and-nutrition, /waitlist) are already indexed and starting to earn clicks.

## KPI baseline to beat (3-month rolling)
- Non-branded share of top-50 clicks: 6.1% → target 15%+ in 6 months
- "breakfast near me" position: 6.7 → target <4
- Legacy-URL clicks: ~44K/3mo → target ~0 after 301s propagate

# Additional Board Findings — Beyond Traffic & Search
Prepared July 7, 2026 · Sources: Google Search Console API (Sitemaps + URL Inspection endpoints, not used previously), GA4 Data API. All first-party via the service account.

---

## 1. The canonical-tag fix is confirmed live by Google's own crawler — not just applied

Ran the URL Inspection API (Google's real indexing-status tool, distinct from the sitemap report) on 7 representative pages: homepage, two location pages (including the previously-broken `columbus-oh` and `dupont-louisville-ky`), a menu item, the menu hub, a blog post, and the allergens page.

- **7 of 7 show `coverageState: "Submitted and indexed"` with the correct self-referencing canonical** — e.g. `dupont-louisville-ky`'s `googleCanonical` now matches its own URL exactly, crawled July 6, one day after the fix shipped.
- **This means Google has already re-crawled and accepted the canonical fix** — the single biggest technical-SEO risk from the original audit is confirmed resolved, not just theoretically fixed.
- **Confidence: 5/5** — directly queried Google's own index, not inferred.

## 2. Rich results (FAQ/Restaurant schema) haven't shown up yet — and now we know exactly why

- The `/menu` page already shows a detected rich result (`Breadcrumbs`, verdict PASS). The location pages checked (`dupont`, `columbus-oh`) show **no rich results detected yet**, despite the schema validating cleanly in Google's testing tool.
- **Reason, confirmed by timestamps:** those pages' `lastCrawlTime` (July 6, before the SchemaInjector code fix and CMS updates published) **predates** today's fixes. Google simply hasn't recrawled since the schema went live — this isn't a bug, it's a crawl-timing gap.
- **Action:** manually request re-indexing via Search Console's "Request Indexing" tool for the ~20 location pages and highest-traffic menu items — Google's Indexing API doesn't support general web pages (it's restricted to job/livestream content), so this has to be done through the GSC UI, not automated. Doing this could compress the "1–4 weeks" wait into days for the pages that matter most.
- **Confidence: 4/5** on the crawl-timing explanation (strongly supported by the timestamp evidence); 3/5 that manual re-indexing requests will meaningfully accelerate the timeline (Google doesn't guarantee this, but it's the standard practice).

## 3. New finding: Crazy Bowls has never submitted a sitemap to Search Console

- Checked sitemap status for both properties. Wild Eggs has an active, clean sitemap (214 URLs, 0 errors, submitted July 6) — but also **11 legacy WordPress-era sitemaps still registered and being crawled** by Google as recently as June 26–30 (multiple http/https/www variants of `post-sitemap.xml`, `page-sitemap.xml`, `sitemap_index.xml`). This is more direct evidence for the domain-consolidation story behind the impression drop in the traffic slides.
- **Crazy Bowls returned an empty sitemap list — no sitemap has ever been submitted for `crazybowlsandwraps.com`.** This is a new, concrete, fixable gap independent of the Framer rebuild — submitting a sitemap today costs nothing and doesn't require waiting for the redesign.
- **Confidence: 5/5** — directly observed via the Sitemaps API for both properties.
- **Caveat:** the "indexed" count field in this API always returns 0 for every entry, on both properties — this is a known deprecation in this endpoint (Google stopped populating it years ago), not a real signal of zero indexing. That's why Section 1 uses the URL Inspection API instead, which is the accurate source.

## 4. Wild Eggs: returning-visitor sessions up 25.6% since launch — a loyalty signal separate from the raw traffic numbers

| | Pre-launch (Jun 24–30) | Post-launch (Jul 1–7) | Change |
|---|---|---|---|
| New-visitor sessions | 8,404 | 8,394 | flat |
| **Returning-visitor sessions** | 1,918 | **2,409** | **+25.6%** |

- New-visitor volume held essentially flat, while returning visits grew meaningfully — a healthy pattern for a relaunch: existing customers are coming back to the new site (and presumably not bouncing off it), rather than the lift being purely a one-time curiosity spike from new traffic.
- **Confidence: 4/5** — clean data, but only 7 days post-launch; worth re-confirming at 30 days.

## 5. Data sources checked and found not yet usable, or not yet activated
For completeness — these were investigated for this report and are either broken or simply not turned on yet, not omitted by oversight:
- **Windsor.ai Instagram/Facebook data** — still returns null/zero values on every field tested, unrelated to the GSC/GA4 fixes; not usable in its current state.
- **Google PageSpeed Insights API (Core Web Vitals)** — not yet enabled in the Google Cloud project; would need the same one-click enable as the other three APIs, plus the same API key already created for Places. Would let us report real mobile/desktop speed scores per page, directly relevant to the "fast, mobile-first" success criterion in the CMO plan.
- **Google Business Profile Performance API** (search views, calls, direction requests per location) — separate from Places, not yet enabled; would close the loop between "Google Maps visibility" and actual GBP-driven actions per location.
- **The possible Supabase/Sixtop database** (real Toast order data, per earlier discussion) — still pending access, unrelated to this report but the highest-value unopened door for order-completion tracking.
- **monday.com boards and additional Drive strategy docs** — not mined further for this pass; flagging as available if a deeper operational-context slide is wanted later.

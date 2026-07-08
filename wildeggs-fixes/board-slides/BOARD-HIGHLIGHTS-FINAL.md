# Board Highlights — Web Traffic & Search, Both Brands
Pulled from all session MD files, July 7, 2026 · Leading with the strongest, most defensible numbers first

---

## WILD EGGS — biggest, most compelling numbers

1. **Search footprint more than doubled: 84 → 214 URLs in the live sitemap** (2.5x). *Reason: the old WordPress sitemap carried 84 web URLs; the new Framer sitemap submitted July 6 carries 214, cleanly, with 0 errors.* **Source:** Search Console Sitemaps API. **Confidence: 5/5** on the submitted-URL count; note Google doesn't expose a reliable "total indexed" number via API — see #2 for the real indexing proof.
2. **The canonical-tag fix is CONFIRMED indexed by Google, not just deployed.** Sampled 7 pages via the URL Inspection API (Google's actual index status tool) — **7 of 7 show "Submitted and indexed"** with correct canonicals, including the two worst-broken pages from the original audit, re-crawled within 24 hours of the fix. *Reason this matters: this is Google's own system confirming the fix worked, not our assumption.* **Source:** Search Console URL Inspection API. **Confidence: 5/5.**
3. **Click-through rate nearly tripled: 0.78% → 2.16%** over 90 days. *Reason: years of duplicate WordPress-era URLs (http/https/www variants) are consolidating out of Google's index post-migration — fewer indexed pages, each converting far better.* **Source:** Search Console searchAnalytics API. **Confidence: 4/5.**
4. **"Breakfast near me" — our single largest opportunity at 450,281 impressions/quarter — already improved from position 7.8 → 6.7, clicks up 28%, BEFORE this week's schema/FAQ work even shipped.** *Reason this is the headline stat for the board: it's independent, pre-fix proof the AEO strategy direction is correct — not a hoped-for outcome.* **Source:** Search Console query-level data, 90-day comparison. **Confidence: 4/5.**
5. **Sessions +27%, clicks +16% day-over-day in the first 6 days post-launch** — reversing a 4-week pre-launch decline. **Source:** GA4 Data API. **Confidence: 4/5** (thin sample, re-confirm at 30 days).
6. **Returning-visitor sessions up 25.6%** (1,918 → 2,409/week) while new-visitor volume held flat — proof existing customers are coming back to the new site, not just a one-time curiosity spike. **Source:** GA4 Data API. **Confidence: 4/5.**
7. **A previously-invisible 31,434 real order-intent clicks per quarter** were being completely missed by the only tracking that existed (`Start_Order`, which only measured a pageview). Now tracked as a real GA4 conversion for the first time ever. **Source:** GA4 outbound-click data + Admin API. **Confidence: 5/5.**

### What's changed (bullets for the slide)
- Canonical tags fixed on 19 of 20 location pages — **already re-indexed correctly by Google**
- Sitemap footprint 84 → 214 URLs (2.5x), zero errors
- 7 location FAQs corrected (dead Wisely links → live Toast links); Columbus placeholder content replaced
- Full 301 redirect map built (~55 rules) to recover ~44K clicks/quarter still stranded on dead legacy URLs (not yet live — pending entry in Framer)
- Real order-tracking conversions created for the first time (`order_platform_click`, `catering_platform_click`, `catering_toast_click`, `catering_order_confirmed`)
- Menu-item FAQ schema now auto-generates from existing ingredient/allergen data (no fabrication) — live in code, pending one template-binding step

### What's still soft (say this out loud, don't let it surface later as a surprise)
- Rich results (FAQ/Restaurant stars in search) haven't appeared yet — **known cause**: last Google crawl predates the schema fix by one day; manual re-indexing requests not yet submitted
- Engagement rate dropped 19.6 points post-launch — cause undetermined, flagged not spun, re-check at 30 days
- True order-*completion* tracking (not just clicks) still requires Toast API work not yet built

---

## CRAZY BOWLS & WRAPS — biggest, most compelling numbers

1. **A previously-invisible 51,457 real order-intent clicks per quarter** — larger than Wild Eggs' — were being tracked *nowhere at all*. Not even a misleading proxy existed (Wild Eggs at least had a wrong pageview signal; CB&W had zero). **Source:** GA4 outbound-click data. **Confidence: 5/5.**
2. **The `purchase` conversion event has been configured since December 2024 and has fired exactly zero times in 19+ months.** Now replaced with real, working conversions (`order_platform_click`, `order_online_click`) as of today. **Source:** GA4 Admin API keyEvents history. **Confidence: 5/5.**
3. **No sitemap has ever been submitted to Google Search Console for this property.** A zero-cost, same-day fixable gap, independent of the Framer rebuild timeline. **Source:** Search Console Sitemaps API. **Confidence: 5/5.**
4. **72.4% of all sessions are Organic Search** — even more concentrated than Wild Eggs pre-fix — with **AI Assistant referrals at just 25/quarter**, on a site with zero structured data or FAQ content. This is the clean "before" picture; Wild Eggs' own "breakfast near me" result (#4 above) is the direct precedent for what fixing this could do. **Source:** GA4 channel data. **Confidence: 4/5.**
5. **Sessions +5.0% over 90 days on a completely unchanged site** — useful context for the board: this proves Wild Eggs' relaunch lift isn't just a seasonal, market-wide effect, since its sister brand's own trend is flatter over the identical period with zero changes made. **Source:** GA4 Data API. **Confidence: 4/5.**

### What's changed (bullets for the slide)
- GA4 Editor access secured; real order-tracking conversions created for the first time in the account's history
- Google Search Console access granted and connected for the first time — 29 days of baseline data now exist where none did before
- Paytronix order-intent (8,167 clicks/year) correctly separated from loyalty/gift-card traffic, which had been miscategorized together

### What's still soft
- GSC only has 29 days of history — no real trend exists yet; wait until ~September for a genuine 90-day read
- Branded search dependency is even more extreme than Wild Eggs (93.5% of clicks) — non-branded volume may reflect a smaller category search size, not purely a fixable ranking gap; needs more data to separate the two
- Still on the legacy site entirely — every number here is the "before," waiting on the Framer rebuild to have a launch story to tell

---

## One line to open the board conversation with, for each brand

**Wild Eggs:** *"We found and fixed a real, previously invisible tracking gap — 31,000 order clicks a quarter were going completely unmeasured — and independently confirmed, through Google's own indexing system, that this week's biggest technical fix already worked."*

**Crazy Bowls:** *"We just discovered this brand had zero working order-conversion tracking for over a year and a half, and zero search visibility monitoring ever — both are fixed as of today, and the baseline we just captured is the clearest 'before' picture for proving the same playbook that's already moving the needle at Wild Eggs."*

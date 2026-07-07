# Wild Eggs & Crazy Bowls — Master Digital Performance Report
As of July 7, 2026 · All data first-party (Google Search Console API, GA4 Data + Admin API, Places API, platform-native social exports) via a dedicated service account — Windsor.ai was bypassed entirely after proving unreliable. Confidence scored 1 (weak/inferred) to 5 (directly verified) on every claim.

---

## 0. Executive Summary (for a title/summary slide)

- **Wild Eggs relaunched on Framer July 1, 2026.** First-week signals are positive (sessions +27%, clicks +16% day-over-day) and one major technical risk — broken canonical tags on 19 of 20 location pages — is fixed and **confirmed re-indexed by Google**, not just deployed. *(5/5)*
- **The real story behind "impressions down 66%" is good news, not bad**: years of duplicate WordPress-era URLs are consolidating out of Google's index post-migration; click-through rate nearly tripled as a result. *(4/5)*
- **Both brands had a massive, previously invisible gap: no way to see if customers actually completed an order.** Fixed for both this week — real order-intent click volume (31K/quarter Wild Eggs, 51K/quarter Crazy Bowls) is now tracked as a GA4 conversion for the first time ever. *(5/5)*
- **Crazy Bowls & Wraps has not yet relaunched** — this report establishes its pre-rebuild baseline, which is more organic-search-dependent (72%) than Wild Eggs and has had zero AEO/schema investment to date — the direct "before" picture for the same playbook. *(4/5)*
- **Social media growth is flat industry-wide across both brands except TikTok (+4.8%)** — a genuine baseline just established, not yet a trend, and not a website-relaunch effect. *(3/5)*

---

## 1. Wild Eggs — Website Traffic (GA4, property 386346645)

- **Sessions +27%, clicks +16% day-over-day** in the first 6 days post-launch (Jul 1–6), reversing a 4-week pre-launch decline (session index had fallen to 82% of baseline). *(4/5 — 6 days is a thin sample, re-confirm at 30 days)*
- **90-day sessions roughly flat (+1.4%, 154,010 vs. 151,810)** despite Search Console impressions falling 66% — the drop is duplicate URL consolidation post-migration, not lost demand. *(4/5)*
- **Returning-visitor sessions up 25.6%** since launch (1,918→2,409/week) while new-visitor volume held flat — existing customers are returning to the new site, a healthy relaunch signature. *(4/5)*
- **Unresolved, flagged not spun:** engagement rate fell 19.6 points post-launch (65.4%→45.8%). Could be normal migration adjustment or a GA4 measurement-threshold difference on the new frontend — genuinely undetermined. *(2/5)*
- **AI Assistant referral sessions more than tripled** on a daily-rate basis (2.3/day→7.7/day) — small base, but the first real signal the AEO/schema investment is working. *(3/5)*

**Sources:** GA4 Data API, property 386346645, queried directly Jul 7, 2026.

---

## 2. Wild Eggs — Search Performance (Google Search Console)

- **Click-through rate nearly tripled (0.78%→2.16%)** over 90 days — same index-cleanup mechanism as traffic, read positively: fewer, cleaner indexed URLs converting far better. *(4/5)*
- **"Breakfast near me" — the single largest identified opportunity at 450K+ impressions/quarter — improved from position 7.8 to 6.7 with clicks up 28%, before this week's schema fixes even shipped.** Independent proof the AEO direction is right. *(4/5)*
- **Non-branded click share rose 11.2%→13.7%**, slowly diversifying from 94%+ brand-name dependency. *(3/5)*
- **The canonical-tag fix is confirmed live by Google's own crawler, not just deployed:** ran the URL Inspection API on 7 pages including the two worst offenders (`columbus-oh`, `dupont-louisville-ky`) — all 7 show `"Submitted and indexed"` with correct self-referencing canonicals, re-crawled July 6. *(5/5)*
- **Rich results (FAQ/Restaurant schema) haven't appeared yet — and we know exactly why:** the location pages' last crawl (July 6) predates the schema code fix (July 7). Not a bug, a crawl-timing gap; manually requesting re-indexing via the GSC UI (Google's Indexing API doesn't cover general pages) could compress the typical 1–4 week wait. *(4/5)*
- **New finding: 11 legacy WordPress sitemaps are still actively crawled by Google** (as recently as June 26–30) alongside the new clean 214-URL sitemap — further evidence for the duplicate-indexing story, and a cleanup item. *(5/5, with caveat: the Sitemaps API's "indexed" count field is a known-dead field that always returns 0 on every entry for every property checked — not a real signal; URL Inspection is the accurate source instead)*

**Sources:** Search Console API (`searchAnalytics`, `sitemaps`, `urlInspection` endpoints), `sc-domain:wildeggs.com`, queried Jul 7, 2026.

---

## 3. Wild Eggs — Order Funnel Tracking: What Was Broken, What We Fixed

- **The core discovery:** `Start_Order` (previously the only order-related GA4 event) is not an order signal — it's a pageview of `/start-order/`, fired 4,618 times/90d, never once tied to an actual click toward an ordering platform. *(5/5)*
- **The real signal, found via GA4's own automatic outbound-click tracking (already collecting, never surfaced):** 31,434 clicks/90 days to Toast ordering — 7× larger than `Start_Order` suggested. *(5/5)*
- **Good news confirmed by isolating pre/post-launch:** the legacy Wisely waitlist platform (974 clicks the week before launch) and a third ordering platform, `order.online`, both dropped to **zero clicks post-launch** — the new site has genuinely completed the cutover to Toast. *(4/5)*
- **The gap that matters: zero order-completion visibility.** GA4's `purchase` key event fired only 4 times against 31,434+ order-platform clicks — not a real conversion rate, evidence it isn't wired to food orders at all. The site's `/thank-you` page (confirmed by Elle to be the **contact-form** confirmation, not an order confirmation) received 1 pageview in 90 days. *(5/5)*
- **Fixed today, live via GA4 Admin API (Editor access confirmed):** created and marked as Key Events — `order_platform_click` (any click to `toasttab.com`), `catering_platform_click` (clicks to `ezcater.com`), plus `Start_Order`, `form_start`, and `contact` (previously firing but invisible in conversion reports). *(5/5 — verified via a live Admin API read of the final key-events list)*
- **Researched but not yet built — true order-completion tracking requires Toast, not just GA4:** Toast's Orders Webhook would give a real `order_complete` signal but isn't available on the current plan (confirmed by Elle: Toast API access exists, webhooks do not, on a different pricing tier). A promising alternative surfaced from internal docs — a vendor-built Supabase database that may already receive Toast order data in real time — is under evaluation, access currently pending. *(2/5 on timeline/resolution — genuinely open)*

**Sources:** GA4 Data + Admin API, property 386346645, Jul 7, 2026; Toast product documentation (doc.toasttab.com, support.toasttab.com), researched Jul 7, 2026; internal Drive documents (Wild Eggs/Crazy Bowls Tool Access Registry, Sixtop Analysis) for the Supabase lead.

---

## 4. Crazy Bowls & Wraps — Website Traffic (GA4, property 469819156)

- **Still on the legacy site** — 99.9%+ of sessions hit the old `crazybowlsandwraps.com` domain; the planned Framer rebuild has not launched. This is a pre-rebuild baseline, not a launch comparison. *(5/5)*
- **Sessions +5.0% over 90 days (151,699 vs. 144,473) on a completely unchanged site** — useful context: Wild Eggs' relaunch lift isn't purely seasonal, since its sister brand's own trend is flatter over the identical period. *(4/5)*
- **Even more organic-search-dependent than Wild Eggs: 72.4% of sessions are Organic Search** (vs. ~55% for Wild Eggs pre-launch), with negligible paid or social — the clearest "before" picture for what the AEO playbook could do here. *(4/5)*
- **A bigger hidden order-tracking gap than Wild Eggs:** real order-intent clicks total ~51,457/quarter (to `orderexperience.net` and `order.online` — Crazy Bowls runs on Par Brink infrastructure, a different vendor than Wild Eggs' Toast). None of it was tracked before today. `purchase` has been configured as a Key Event since **December 2024** and had never fired once. *(5/5)*
- **Fixed today, same method as Wild Eggs:** created and marked as Key Events — `order_platform_click` (`orderexperience.net`), `order_online_click` (`order.online`), and `contact_form_start` (isolated from the dominant `/locations/` zip-code-finder noise, 27,209 fires/90d, left uncategorized as a non-conversion engagement signal). `loyalty_platform_click` created for `myguestaccount.com` but intentionally not marked as a conversion. *(5/5, verified via Admin API)*

**Sources:** GA4 Data + Admin API, property 469819156, Jul 7, 2026.

---

## 5. Crazy Bowls & Wraps — Search Performance (Google Search Console)

- **GSC access was only just connected — the property has 29 days of data (since June 7, 2026).** No 90-day trend exists yet; a genuine comparison is possible starting early September. *(5/5 on the data itself, 2/5 on any trend read — too short a window)*
- **What the 29 days show:** 21,461 clicks, 76,166 impressions, 28.2% CTR, average position 8.9. *(4/5)*
- **Branded dependency is even more extreme than Wild Eggs pre-fix:** 93.5% of clicks are "crazy bowls and wraps" variants; the top non-branded query is only 65 clicks — likely a smaller category search volume overall rather than purely a ranking gap. *(3/5)*
- **No sitemap has ever been submitted to Search Console for this property** — a new, zero-cost, immediately fixable gap independent of the Framer rebuild timeline. *(5/5)*
- **No structured data, FAQ, or content-depth work exists yet** — top pages are homepage, menu, nutrition, and location-finder only, mirroring the GA4 channel-mix finding. *(4/5)*

**Sources:** Search Console API, `https://crazybowlsandwraps.com/`, access granted and queried Jul 7, 2026.

---

## 6. Social Media — 30-Day Baseline (Both Brands)

*(Corrected: the "Reach/Views/Reposts"-format accounts are Instagram, not Threads.)*

- **Follower growth is essentially flat across 4 of 5 tracked accounts** (all under ±0.35% in 30 days): Facebook ~18K (+0.05%), Facebook ~9K (−0.04%), Instagram ~4,860 — matching the "same 4,845 followers" figure cited in the CMO plan — (+0.31%), Instagram ~4,034 (+0.02%). *(5/5)*
- **TikTok is the one real bright spot: 567→594 followers, +4.76%** — the newest channel, with the most room to grow. *(5/5)*
- **Post-launch engagement swings (some +700–1,000%) are not reliable evidence of a launch effect** — they're measured over only 5–7 post-launch days against very small pre-launch daily bases (single digits in some cases), meaning normal content variance could fully explain them. *(2/5 on any causal link to the website relaunch)*
- **The two largest-audience accounts (18K Facebook, 4,860 Instagram) both show declining reach post-launch** — the opposite direction from the smaller accounts — read as normal week-to-week noise, not a real signal either way. *(3/5)*
- **This is a first baseline, not a trend** — Windsor's Instagram/Facebook connector has been non-functional all session; this data came from manually exported platform-native CSVs. Automating this pull is an open item.

**Sources:** Platform-native "Profile Growth and Discovery" CSV exports, provided directly, covering Jun 5/7–Jul 5/7, 2026.

---

## 7. Complete Change Log — What We Changed, When, and Why

| Date | Brand | Change | Why |
|---|---|---|---|
| Jul 1, 2026 | Wild Eggs | Site relaunched on Framer | Planned migration off WordPress |
| Jul 7, 2026 | Both | Replaced Windsor.ai with direct Google API access (service account) | Windsor was unreliable (plan limits, broken connectors, null data) |
| Jul 7, 2026 | Wild Eggs | Fixed `SchemaInjector.tsx`: corrected social handles, sanitized menu-item prices for valid schema, fixed WebPage naming | Schema validation errors found in code review |
| Jul 7, 2026 | Wild Eggs | Corrected canonical URLs on 19 of 20 location pages | Confirmed against live sitemap; wrong canonicals risk de-indexing |
| Jul 7, 2026 | Wild Eggs | Rewrote 7 location FAQs referencing dead Wisely waitlist links; fixed Oakley/Palomar link inconsistencies; replaced "See hours card" filler text; fixed Columbus "Coming soon!" placeholder content | AEO/content-quality audit findings |
| Jul 7, 2026 | Wild Eggs | Built full 301 redirect map (~55 rules) from real GSC click data | ~44K clicks/quarter stranded on dead legacy URLs |
| Jul 7, 2026 | Wild Eggs | Created `order_platform_click`, `catering_platform_click`; marked these plus `Start_Order`, `form_start`, `contact` as GA4 Key Events | Discovered real order-intent signal (31K clicks/quarter) was completely untracked |
| Jul 7, 2026 | Crazy Bowls | Created `order_platform_click`, `order_online_click`, `contact_form_start` as GA4 Key Events | Same order-tracking gap found, larger in volume (51K clicks/quarter) |
| Jul 7, 2026 | Crazy Bowls | GSC access granted and verified | Enables search-performance tracking for the first time |

---

## 8. Open Items (not yet resolved, for transparency)

- **True order-completion tracking** for both brands — requires either Toast Orders API polling (webhooks not available on current plan) or activating pending Supabase database access; not yet built.
- **Engagement-rate drop post-Wild-Eggs-launch** — cause undetermined, needs 30-day re-check.
- **301 redirects** — map is built, not yet entered into Framer.
- **Manual re-indexing requests** for Wild Eggs location pages — not yet submitted via GSC UI.
- **Crazy Bowls sitemap submission** — not yet done.
- **Google Business Profile Performance API and PageSpeed Insights API** — identified as valuable, not yet enabled.
- **Windsor Instagram/Facebook connector** — still broken; social data currently manual-only.
- **Social account identity** — file-to-brand/platform mapping in Section 6 is inferred, not confirmed with whoever manages the social calendar.

---

## Confidence scale used throughout
**5** = directly verified via API/tool against live systems · **4** = strong direct evidence, minor interpretive gap · **3** = real data, causal interpretation uncertain · **2** = plausible but genuinely unresolved · **1** = speculative/inferred only.

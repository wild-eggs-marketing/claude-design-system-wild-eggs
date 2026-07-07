# Board Slides — Wild Eggs & Crazy Bowls Digital Performance
July 7, 2026 · All figures first-party (GSC/GA4 APIs, service account) · Confidence noted where it matters

---

## Slide 1 — Wild Eggs: Website Traffic (GA4)

- **Sessions +27%, clicks +16% day-over-day in the first 6 days** after the July 1 Framer relaunch, reversing a 4-week pre-launch decline (session index had fallen to 82% of baseline, jumped to 109% launch week).
- **90-day sessions roughly flat (+1.4%)** despite a 66% drop in Search Console impressions — that drop is old duplicate URLs (http/https/www variants, dead WordPress paths) falling out of Google's index post-migration, not lost demand. *(Confidence 4/5)*
- **Watch item, not yet resolved:** engagement rate fell 19.6 points post-launch (65.4%→45.8%). Could be normal migration adjustment or a GA4 measurement-threshold difference on the new frontend — genuinely undetermined, re-check at 30 days. *(Confidence 2/5)*
- **AI Assistant referral sessions more than tripled** on a daily-rate basis (2.3/day→7.7/day) — small base, but the first real signal the AEO/schema investment is working.
- **Fixed this week:** GA4 Key Events were nearly nonexistent — only `purchase` (dead, 4 fires/90d) and `generate_lead` were configured. Discovered the real order signal (31,434 Toast clicks/quarter) was invisible; created and activated `order_platform_click` and `catering_platform_click` as tracked conversions, live now.

---

## Slide 2 — Wild Eggs: Search Performance (Google Search Console)

- **Click-through rate nearly tripled (0.78%→2.16%)** over 90 days — same index-cleanup mechanism as Slide 1, read positively: fewer indexed URLs, each converting far better.
- **"Breakfast near me" — our single largest opportunity at 450K+ impressions/quarter — already improved from position 7.8 to 6.7 with clicks up 28%, before this week's schema fixes even shipped.** Independent proof the AEO direction is right.
- **Non-branded click share rose 11.2%→13.7%**, slowly diversifying away from 94%+ brand-name dependency.
- **Rich results (FAQ/Review) haven't appeared in search yet (0 impressions)** — expected; Restaurant/FAQPage/MenuItem schema now validates cleanly in Google's own testing tool, but surfacing in live results typically takes 1–4 weeks post-migration. This is the metric to report next cycle.
- **Fixed this week:** 19 of 20 location pages had broken (non-self-referencing) canonical tags — confirmed against the live sitemap and corrected; plus a full 301 redirect map built from real click data to recover ~44K clicks/quarter still landing on dead legacy URLs (entry pending in Framer).

---

## Slide 3 — Crazy Bowls & Wraps: Website Traffic (GA4)

- **Still on the legacy site** — the Framer rebuild in the CMO plan hasn't launched (99.9% of sessions are on the old `crazybowlsandwraps.com`, 2 sessions total on the new staging domain). This is a pre-rebuild baseline, not a launch comparison.
- **Sessions +5.0% over 90 days on a completely unchanged site** — useful board context: Wild Eggs' relaunch lift isn't just a market-wide seasonal effect, since its sister brand's own trend is flatter over the identical period.
- **Even more organic-search-dependent than Wild Eggs (72% of sessions vs. ~55%)**, with negligible paid or social — the clearest "before" picture for what the same AEO playbook could do here.
- **Bigger hidden order-tracking gap than Wild Eggs:** real order-intent clicks total ~51,457/quarter (to `orderexperience.net` and `order.online`, CB&W's Par Brink-based ordering stack — different vendor than Wild Eggs' Toast) — none of it was tracked. `purchase` has been configured as a Key Event since **December 2024** and has never fired once.
- **Not yet fixed** — same event-creation pattern used for Wild Eggs is scoped and ready to execute on this property as soon as prioritized.

---

## Slide 4 — Crazy Bowls & Wraps: Search Performance (Google Search Console)

- **Search Console access was only just connected — the property has 29 days of data (since June 7, 2026).** No 90-day trend exists yet; a real comparison will be possible in early September.
- **What the 29 days show:** 21,461 clicks, 76,166 impressions, 28.2% CTR, average position 8.9.
- **Branded dependency is even more extreme than Wild Eggs pre-fix:** 93.5% of clicks are on "crazy bowls and wraps" variants; the top non-branded query ("crazy bowls and wraps near me") is only 65 clicks — likely a smaller category search volume overall, not purely a ranking gap, but needs more data to confirm.
- **No structured data, FAQ, or content-depth work exists yet** — top pages are homepage, menu, nutrition info, and location finder only, mirroring the GA4 picture with zero AEO investment so far.
- **Fixed this week:** nothing yet on this property beyond establishing the measurement pipeline itself (GA4 + GSC access, both confirmed working) — this baseline is what "fixed" will be measured against going forward.

---

## Tracking setup timeline (both brands, for context if asked)

| Date | Event |
|---|---|
| Dec 9, 2024 | Crazy Bowls GA4 property created; `purchase` key event configured (never fired since) |
| Jun 10, 2026 | `generate_lead` key event added to both properties, ~3 weeks pre-launch |
| Jul 1, 2026 | wildeggs.com relaunches on Framer |
| Jul 7, 2026 | Windsor.ai replaced with direct GSC/GA4/Places API access; GA4 Editor access granted; `Start_Order`, `form_start`, `contact`, `order_platform_click`, `catering_platform_click` marked/created as Key Events for Wild Eggs; Crazy Bowls GSC access granted |

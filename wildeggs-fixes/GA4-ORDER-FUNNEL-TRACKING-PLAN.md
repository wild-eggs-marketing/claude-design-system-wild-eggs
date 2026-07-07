# Wild Eggs — Order Funnel Tracking: Findings & Fix Plan
Prepared July 7, 2026 · Source: GA4 Data API + Admin API, property 386346645

## The core finding

**`Start_Order` is not an order signal — it's a pageview of the `/start-order/` page.** Every one of its 4,618 fires (90 days) happened on that single URL. It tells us someone reached a hub page, not that they clicked through to a specific location's ordering platform, let alone completed a purchase.

**The real order-intent signal is much larger and was invisible until this analysis:** GA4's automatic outbound-link click tracking (event `click`, already firing, just never isolated or reported on) shows:

| Destination | Clicks (90 days) | Users | What it is |
|---|---|---|---|
| **Toast ordering** (`toasttab.com`, `order.toasttab.com`) | **31,434** | ~21,760 | Real "start an order" clicks, across all locations |
| Wisely waitlist (`getwisely.com`) | 18,497 | ~14,562 | **Legacy** — see below, this is a pre-launch artifact, not current |
| `order.online` (a third ordering platform) | 2,595 | ~1,624 | Also legacy — concentrated in April/May, zero in the last two weeks |
| ezCater (catering) | 40 | 35 | Very low — matches the audit finding that catering content/visibility is thin |
| Careers (Paylocity) | 2,506 | 1,852 | Not order-related, exclude from any funnel work |

**Good news confirmed by isolating pre- vs. post-launch:** Wisely clicks were 974 in the week before launch and **0 in the six days since** — the new Framer site has genuinely eliminated live Wisely links (matches the CMO plan's "fix Wisely" item). The FAQ-text references I corrected this week were copy cleanup on top of a platform switch that had already happened at the link level. `order.online` shows the same pattern — already phased out, not a current issue.

**The gap that actually matters: there is no order-completion signal at all.**
- GA4's `purchase` key event fired **4 times in 90 days** — against 31,434+ clicks toward Toast. That is not a real conversion rate; it means `purchase` isn't wired to food orders at all (it's most likely tied to something else on-domain, like a gift-card checkout, not the Toast order flow, since Toast checkout happens off wildeggs.com and nothing sends a signal back).
- The site has a `/thank-you` page (visible in the Framer page tree) that would be the natural place to land after a completed action — it received **1 pageview in 90 days**, referred by a DuckDuckGo search, not a real post-order redirect. It's orphaned.

**Bottom line: today, Wild Eggs can see "how many people clicked toward ordering" but has zero visibility into "how many actually ordered."** That's the real answer to "how do customers move across the site to make orders" — right now, the trail goes dark exactly at the moment it matters most.

---

## Recommended fix, in order

### 1. Stop conflating pageview and intent — DONE, live as of July 7
Executed directly via the GA4 Admin API (Editor access confirmed working):
- Created `order_platform_click` — an event-create rule that fires whenever the existing `click` event's `link_url` contains `toasttab.com`
- Created `catering_platform_click` — same pattern for `link_url` containing `ezcater.com`
- Marked both as **Key Events**, along with `Start_Order`, `form_start`, and `contact` (previously firing but invisible in conversion reporting)

These rules are forward-only — GA4 doesn't backfill historical `click` events into the new named events, so `order_platform_click` volume starts accumulating from today. Expect it to land close to the ~31,434/quarter run-rate already observed in the raw click data.

### 2. Close the loop on actual order completions — requires Toast, confirmed via research (not just GA4)
**Correction from my earlier assumption:** you clarified `/thank-you` is the **contact-form** confirmation page, not an order-completion page — so that fallback doesn't apply. Researched Toast's actual capabilities directly; here's what's real, ranked:

1. **Best, and the only way to see individually completed/paid orders: Toast's Orders Webhook → GA4 Measurement Protocol.** Toast has a live, documented webhook (`order_updated`) that fires in real time with full order data whenever an order completes. A small server-side integration (webhook receiver → forward as a server-side GA4 event) would give a true `order_complete` conversion, independent of any redirect. Requires: Toast RMS Essentials-or-higher plan, "Manage Integrations" permission, and Toast API credentials (requested via Toast's integrations team) — this is a scoped build, not a checkbox. **Confidence: 4/5** this works as described (official Toast developer docs); 2/5 on effort/timeline since it needs a small server component someone has to own.
2. **Quick partial win: Toast's native GA4/Meta Pixel fields.** Toast Online Ordering Pro has a built-in "Marketing & Analytics" settings screen (Toast Web → Settings & Integrations) where you paste a GA4 Measurement ID and/or Meta Pixel ID directly — no code. This should start firing *some* completion signal from the toasttab.com side. Two caveats found: (a) this needs **GA4 Cross-Domain Measurement** turned on for `toasttab.com` alongside `wildeggs.com`, or GA4 will treat it as a disconnected new session rather than linking it to the original click; (b) a Toast operator community thread reports Content Security Policy restrictions block full custom GTM containers, so this native field is likely limited to a final-purchase signal, not a full add-to-cart/checkout funnel. Worth turning on this week regardless — it's free and additive. **Confidence: 3/5** on how clean the resulting data will be; validate at one location before treating it as reliable across all 19.
3. **Backstop, always worth having: Toast's own reporting.** Toast exports a nightly per-location Sales Summary / Order Details CSV (and has a bulk Orders API) with real order counts and revenue per location per day. Use this to sanity-check whatever GA4 signal comes from #1 or #2 — e.g., compare GA4's `order_platform_click` count against Toast's actual order count per location to estimate a true click-to-order rate, even without perfect individual-order attribution.
4. **Not viable:** a redirect back to a Wild Eggs-owned confirmation page on order completion — researched directly, no evidence Toast supports this. Don't plan around it; the webhook approach (#1) is the substitute since it doesn't depend on the browser ever returning to wildeggs.com.
5. **Not applicable:** there's no packaged, one-click "Google Analytics" app in Toast's integration marketplace — the only Google integration listed is "Order with Google" (an ordering-channel feature, not analytics).

Sources: [Toast — GA/Facebook Pixel tracking support](https://support.toasttab.com/en/article/Can-I-use-Google-Analytics-or-Facebook-Pixel-to-track-performance-for-my-Toast-Online-Ordering-page), [Toast Orders Webhook reference](https://doc.toasttab.com/doc/devguide/devOrdersWebhookRef.html), [Toast API access requirements](https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html), [Toast Automated Nightly Data Export](https://support.toasttab.com/en/article/Automated-Nightly-Data-Export-1492723819691), [Toast Sales Summary Report](https://support.toasttab.com/en/article/Sales-Summary-Report).

### 3. Reservations and catering need the same treatment
- Reservations: confirm what the current post-launch reservation flow actually is (Toast Tables per the Month 1 doc) and apply the same outbound-click-to-key-event pattern.
- Catering: only 40 ezCater clicks in 90 days is itself a finding — worth a content/visibility check on the `/catering` page, independent of tracking.

### 4. Fix the two smaller, already-identified gaps
- Mark `form_start` and `contact` as Key Events (low volume, but currently invisible reservation/contact-intent signals).
- Decide whether `order_start`, `reservation_complete`, `catering_click`, `loyalty_signup` (the original CMO plan names) should be implemented as distinct events or retired in favor of the `_platform_click` naming above — recommend the latter, since it matches what's actually happening on the site today.

---

## Write access — resolved

Editor role on GA4 property `386346645` was granted and confirmed working as of July 7, 2026 (verified with a live write test before executing the changes above).

## Confidence scores
- Start_Order = pageview-only, not order-intent: **5/5** (every single fire is on one URL, directly observed)
- Toast click volume (31,434/90d) as the real order-intent signal: **5/5** (directly observed via GA4's own outbound-click tracking)
- Wisely/order.online fully phased out post-launch: **4/5** (confirmed zero in the 6-day post-launch window and the 7-day pre-launch comparison; would be 5/5 with 2-3 more weeks of confirmation)
- No true purchase-completion signal exists today: **5/5** (directly observed: 4 purchase events vs 31K+ clicks, /thank-you at 1 pageview)
- Toast redirect-on-completion capability: **2/5** — not yet confirmed with Toast; this is a question to ask them, not a verified fact

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

### 1. Stop conflating pageview and intent — create real conversion events (this week)
In GA4 Admin → Events → **Create event**, build events *from* the existing outbound `click` event, filtered by `link_url`:
- `order_platform_click` — where `link_url` contains `toasttab.com`
- `catering_platform_click` — where `link_url` contains `ezcater.com`
- (Skip a Wisely/waitlist event — confirmed dead post-launch.)

Then mark `order_platform_click` as a **Key Event**. This alone turns an invisible 31,000+/quarter signal into a reportable, per-location, per-page conversion metric — immediately more useful than trying to fix `Start_Order`.

### 2. Close the loop on actual completions (next 2–4 weeks — requires Toast, not just GA4)
This is the piece GA4 alone cannot solve, because checkout happens on Toast's domain:
- **Best option:** Toast supports order webhooks / a confirmation redirect parameter on some integration tiers — check with Toast support whether orders can redirect back to `wildeggs.com/thank-you?location={slug}&order_id={id}` on completion. If yes, wire GA4 to treat `/thank-you` pageviews as the true `order_complete` key event, finally giving a real numerator against the 31,434 clicks.
- **Fallback if Toast can't redirect:** pull completed-order counts directly from **Toast's own reporting** (Toast has this natively, per location) and reconcile manually against GA4's click volume monthly — not real-time, but gives a true conversion rate until #1 is possible.
- **Do not** try to mark GA4's generic `purchase` event as the answer — confirmed it isn't tied to the order flow.

### 3. Reservations and catering need the same treatment
- Reservations: confirm what the current post-launch reservation flow actually is (Toast Tables per the Month 1 doc) and apply the same outbound-click-to-key-event pattern.
- Catering: only 40 ezCater clicks in 90 days is itself a finding — worth a content/visibility check on the `/catering` page, independent of tracking.

### 4. Fix the two smaller, already-identified gaps
- Mark `form_start` and `contact` as Key Events (low volume, but currently invisible reservation/contact-intent signals).
- Decide whether `order_start`, `reservation_complete`, `catering_click`, `loyalty_signup` (the original CMO plan names) should be implemented as distinct events or retired in favor of the `_platform_click` naming above — recommend the latter, since it matches what's actually happening on the site today.

---

## Blocker: write access

All of the above requires **Editor** role on GA4 property `386346645` for the service account `wild-eggs-cbw-analytics@deep-byte-500814-m1.iam.gserviceaccount.com`. As of this writing, every write attempt (creating a key event, even a no-op property PATCH) returns `403 PERMISSION_DENIED`, meaning the account is still effectively Viewer-only regardless of what was granted. **Action needed:** in GA4 Admin → Property Access Management (not Account Access Management — they're separate screens), confirm the service account is listed with role **Editor**, re-save if needed, and allow a minute or two for propagation before retrying.

## Confidence scores
- Start_Order = pageview-only, not order-intent: **5/5** (every single fire is on one URL, directly observed)
- Toast click volume (31,434/90d) as the real order-intent signal: **5/5** (directly observed via GA4's own outbound-click tracking)
- Wisely/order.online fully phased out post-launch: **4/5** (confirmed zero in the 6-day post-launch window and the 7-day pre-launch comparison; would be 5/5 with 2-3 more weeks of confirmation)
- No true purchase-completion signal exists today: **5/5** (directly observed: 4 purchase events vs 31K+ clicks, /thank-you at 1 pageview)
- Toast redirect-on-completion capability: **2/5** — not yet confirmed with Toast; this is a question to ask them, not a verified fact

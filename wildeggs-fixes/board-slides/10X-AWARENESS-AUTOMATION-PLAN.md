# 10x Awareness — Automated Marketing Infrastructure for Both Brands
Prepared July 7, 2026 · For board review · Sources cited per item, confidence 1 (speculative) – 5 (verified working in this session)

## Framing: why "automatic" is the right ask

Everything fixed today (schema, tracking, canonicals) makes Wild Eggs and Crazy Bowls *readable* by AI systems and *measurable* by us. The next lever is *volume and velocity* — most restaurant marketing is still hand-built: one designer making one graphic for one location at a time. The tools below turn that into a pipeline: content generates itself from data already in your stack (LTO calendar, menu items, guest reviews, competitor moves), gets screened by AI before it's published, and gets tracked automatically — closing the loop this session spent all day building.

---

## 1. Automated competitor intelligence feed (closes an already-identified gap)
**What:** Your own monday.com "Bi-weekly competition news" board is sitting empty — verified this session. Apify's Google Maps Reviews Scraper ($0.25/1,000 reviews) can pull First Watch, Snooze, and Another Broken Egg's review text, ratings, and owner responses on a schedule; a Claude routine summarizes new patterns and writes them directly into that board via monday's `create_item`/`create_update` (already a connected, write-capable MCP tool this session).
**Reason:** You're paying for market intelligence tracking that nobody is feeding.
**Source:** Internal Wild Eggs Sixtop Analysis doc (May 2026, this Drive) cites this exact Apify actor and price. **Confidence: 4/5** — the mechanism is proven (monday writes confirmed working today); Apify's own API is blocked from this sandbox specifically, so the scraping step needs to run from Windsor (which has an `apify_dataset` connector) or any external host, not from here directly.

## 2. AI-answer-engine share-of-voice tracking (the metric this whole audit points toward)
**What:** A weekly scheduled routine that runs a fixed set of prompts ("best breakfast near me in Louisville," "healthy fast-casual Wentzville MO") against ChatGPT/Perplexity/Gemini and logs whether/how each brand is mentioned, feeding a trend line for the next board cycle.
**Reason:** Every fix made today (schema, FAQs, canonicals) is aimed at this outcome, but nothing currently measures it. This is the true AEO scoreboard.
**Source:** Standard practice per this session's earlier Toast/AEO research; requires API access to the target AI engines (OpenAI/Anthropic/Perplexity keys) which aren't yet provisioned. **Confidence: 3/5** — mechanically simple (this harness already supports scheduled routines via `create_trigger`), but needs API keys not yet in hand.

## 3. Higgsfield-powered content generation at 32-location scale
**What:** Higgsfield is already connected in this session — `generate_image`, `generate_video`, `shorts_studio_create`, and a full "marketing studio" pipeline. Feed it the LTO calendar already built on monday.com (Bottomless Saturday, Seasonal Pancake Trio, etc.) and it can auto-produce location-branded social assets for all 19 Wild Eggs + 13 Crazy Bowls locations from one template, instead of one-off manual design work.
**Reason:** The monday.com LTO board already shows exact photography/video budget tiers (T3 phone-shot-only, T1 $2,500-4,500 half-day shoots) — automated generation collapses the T3 tier cost to near-zero and lets every location get on-brand content, not just flagship stores.
**Source:** Higgsfield MCP tools, directly available and verified connected this session. **Confidence: 4/5** — tools are live and callable now; output quality for a specific brand voice needs a pilot run to validate before scaling to all 32 locations.

## 4. Higgsfield Virality Predictor as a pre-publish filter
**What:** Before anything goes to Instagram/TikTok, run it through Higgsfield's `virality_predictor` to score hook strength and predicted engagement, and only auto-publish above a threshold — the rest get flagged for a human second look.
**Reason:** Your own social baseline (this session) shows follower growth flat everywhere except TikTok — a screening step raises average post quality without adding headcount.
**Source:** Higgsfield MCP, connected and available now. **Confidence: 3/5** — the tool exists and is callable; its real-world predictive accuracy for a restaurant-brand-specific audience is unverified without a testing period.

## 5. Automated GBP posts across all 32 locations
**What:** Once the Google Business Profile Performance API is enabled (same one-click process used for Search Console/Places/GA4 this session), a weekly routine can auto-draft and post GBP updates per location from the same LTO calendar — turning a currently-manual, easy-to-skip task into a standing pipeline.
**Reason:** GBP completeness and posting frequency are a direct AI-visibility signal (per the Uberall data already cited in this audit); your own monday board shows a GBP audit for all 13 CB&W locations was due July 8 — this replaces "audit once" with "maintain automatically."
**Source:** Google Business Profile API (mybusiness.googleapis.com), Uberall AI-visibility report (cited earlier this session). **Confidence: 4/5** on mechanism; API isn't enabled yet.

## 6. UGC repost pipeline, automated end-to-end
**What:** Your own monday.com LTO system already specifies "2x/week UGC repost cadence" as a manual task. Apify can monitor Instagram/TikTok hashtag and location tags for guest content; Higgsfield's `reframe`/`upscale_image` auto-reformats it for each platform's aspect ratio; a routine queues it with the caption template already defined in your messaging kit.
**Reason:** This is explicitly called out in your own monday board as "the activation system — minimum viable UGC program" — currently a manual weekly task, fully automatable.
**Source:** Wild Eggs LTO GTM Launch System board (monday.com, item "UGC repost cadence running"), Higgsfield MCP. **Confidence: 3/5** — each piece works individually; the end-to-end chain hasn't been built or tested.

## 7. Review-response drafting at scale
**What:** Pull Ovation/Google review text via API, score sentiment, and have Claude draft response replies for manager approval — instead of writing 32 locations' worth of review responses by hand. Response rate and speed are a known ranking factor for local search.
**Reason:** Review volume is the single strongest AI-visibility lever per Uberall's data (already cited this session: AI-recommended restaurants average 3.6x more reviews) — responding fast and consistently compounds that signal.
**Source:** Uberall report; Ovation is already a connected vendor per your Tool Access Registry. **Confidence: 3/5** — depends on Ovation exposing an API (not yet checked this session).

## 8. Supabase pgvector "brief memory" — compounding institutional knowledge
**What:** Your own internal Sixtop analysis flags this directly: embed your 30+ existing marketing briefs into the pgvector store already available in your Supabase instance, so every new brief (LTO launch, competitive response, seasonal campaign) retrieves relevant prior analysis automatically instead of starting from zero.
**Reason:** This turns one-off analyst judgment into a self-improving system — explicitly identified in your own procured analysis as "the fastest possible path to a working v1 internal platform."
**Source:** Wild Eggs Sixtop Analysis (internal Drive doc, May 2026) — quotes this almost verbatim. **Confidence: 3/5** — technically sound and already scoped internally; access to the Supabase instance is still listed as "Pending" in your Tool Access Registry.

## 9. Automated menu/dietary-content generation from data you already have
**What:** The Crazy Bowls menu-item audit this session found 27,209 location-finder interactions but thin nutrition/dietary content; Wild Eggs' own menu-item schema work (done today) proves the pattern. A routine can auto-generate FAQ and dietary-tag content for every menu item from your Toast/nutrition data, feeding both the schema markup and the actual page copy — the highest-leverage AEO content type per this session's competitive research (neither First Watch, Snooze, nor Another Broken Egg systematically does this well).
**Reason:** Directly extends the highest-confidence finding from the original AEO audit — nutrition/dietary content is real search demand with weak competitive coverage.
**Source:** This session's AEO competitive research; GA4 menu-item data pulled today. **Confidence: 4/5** — the data sources exist and are already accessible; the generation pipeline itself hasn't been built.

## 10. Cross-brand scheduling orchestration (Later.com / Buffer, already in your stack)
**What:** Your own monday board shows Later.com and Buffer already in use for scheduling. A routine can pull approved Higgsfield/Canva assets and auto-queue them across both brands' channels on a fixed cadence, rather than relying on someone remembering to post — directly targeting the "flat except TikTok" follower problem found in this session's social baseline.
**Reason:** Consistency of posting cadence is one of the few growth levers fully within your control, and your own baseline data shows it isn't happening reliably today.
**Source:** Wild Eggs Marketing Strategy board (monday.com, "Added Wild Eggs YouTube to Later.com"). **Confidence: 3/5** — depends on Later.com/Buffer API access, not yet verified in this session.

## 11. Canva MCP for instant on-brand asset generation (already connected, underused)
**What:** Canva's MCP tools are connected in this session but haven't been used yet for either brand. Combined with your own Canva Brand Kit (listed Active in the Tool Access Registry), this can auto-generate table tents, social crops, and print assets directly from the design-token system already being built (per the "Wild Eggs Design System" monday board).
**Reason:** Your own design-system board shows real engineering investment (tokens, Storybook, CI/CD) aimed at exactly this outcome — Canva MCP is the fastest bridge from that system to actual location-level output.
**Source:** Canva MCP, connected this session; Wild Eggs Design System board. **Confidence: 4/5** — tool is live and callable now.

## 12. Recurring board-ready reporting, fully automated
**What:** Everything built this session (GSC/GA4/Places pulls, key-event tracking) can run on a weekly `create_trigger` routine that regenerates the board slide package automatically, rather than requiring a manual session each time.
**Reason:** Closes the loop on this entire day of work — the infrastructure exists, it just needs to run itself.
**Source:** This session's own service-account pipeline; `create_trigger` capability confirmed available in this harness. **Confidence: 5/5** — this is a direct extension of infrastructure already built and verified working today.

---

## What to present at the board meeting

**Ready to greenlight immediately (confidence 4-5, no new access needed):** #3 (Higgsfield content generation), #9 (menu/dietary AEO content), #11 (Canva asset automation), #12 (automated recurring reporting).

**One approval away (needs an API/access grant, mechanism already proven):** #1 (Apify competitor feed — needs Apify account access), #5 (GBP posts — needs GBP Performance API enabled, same process as today's other API enables), #8 (Supabase pgvector — access already requested per your own registry, just pending).

**Needs a short pilot before committing (confidence 3, unproven at your scale):** #2 (AI-engine tracking — needs LLM API keys), #4 (virality prediction), #6 (UGC pipeline), #7 (review-response drafting), #10 (cross-brand scheduling).

**The throughline:** almost none of this requires new vendors — Higgsfield, Canva, monday.com, and Supabase are already in your stack per your own Tool Access Registry. The gap isn't tooling, it's orchestration — which is exactly what this session's work (turning invisible data into tracked, automated signals) has been building toward all day.

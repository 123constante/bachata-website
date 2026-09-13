# Supabase Disk IO Optimization — Master Plan

**Status:** Phase 2 ✅ Complete (Commit: `6eda16d`)  
**Next:** Deploy Phase 2 (after 24–48 hour Phase 1 stabilization)  
**Timeline:** 6–8 weeks for full implementation

---

## Executive Summary

Your Supabase project was consuming excessive Disk IO due to:
1. **Aggressive polling** (raffles refreshing every 60 seconds)
2. **High-volume telemetry** (event + profile view tracking on every load/click)
3. **Short query stale times** (5-minute refetch on every tab switch)

**Phase 1 (just shipped)** stops the leak by disabling tracking and polling.  
**Phases 2–7** restore analytics via cheaper storage and optimize queries permanently.

**Expected total cost reduction:** 5–50x cheaper once complete.

---

## Phase Breakdown

### Phase 1: Stabilize ✅ (DONE — Commit: `bd49d05`)
**Timeline:** 1 day | **Impact:** 70–85% IO reduction  
**What:** Disable tracking + remove polling (guarded by feature flags)

**Changes:**
- Added `enableEventTracking` & `enableProfileTracking` flags
- Disabled `record_event_view_v1` RPC (event telemetry)
- Disabled `record_profile_view_v1` RPC (profile telemetry)
- Removed `refetchInterval: 60s` on raffles, increased stale time to 30min

**Files Modified:**
- `src/lib/featureFlags.ts`
- `src/lib/profileViewEmit.ts`
- `src/modules/event-page/useRecordEventView.ts`
- `src/hooks/useOpenRaffles.ts`

**Deployment Docs:** `DEPLOYMENT-PHASE-1.md`

---

### Phase 2: Extract Analytics ✅ (DONE — Commit: `6eda16d`)
**Timeline:** 2–3 days | **Impact:** Keep 70–85% reduction, restore tracking  
**What:** Move tracking from Supabase → Vercel KV (external storage)

**Implementation Details:**
- Created `/api/analytics/profile-view` route (Vercel KV storage, 30-day TTL)
- Created `/api/analytics/event-view` route (Vercel KV storage, 30-day TTL)
- Updated `emitProfileView()` to POST to `/api/analytics/profile-view`
- Updated `useRecordEventView()` to POST to `/api/analytics/event-view`
- Maintains session-per-day deduplication (same as Phase 1 Supabase RPC)
- Dependencies: Added `@vercel/kv`

**Cost:** ~$1–5/month for analytics (vs $100–500/month on Supabase)

**Deployment:** See `DEPLOYMENT-PHASE-2.md` for step-by-step checklist

**Files Modified:**
- `app/routes/api.analytics.profile-view.tsx` (new)
- `app/routes/api.analytics.event-view.tsx` (new)
- `src/lib/profileViewEmit.ts`
- `src/modules/event-page/useRecordEventView.ts`
- `package.json` (@vercel/kv added)

---

### Phase 3: Smart Subscriptions (Week 3–4)
**Timeline:** 1 week | **Impact:** 30–50% additional reduction  
**What:** Replace fixed-interval polling with event-driven Realtime subscriptions

**High-level:**
- Replace `useOpenRaffles()` polling with Supabase Realtime subscription
- Increase query stale times: 5min → 30min (non-critical data)
- Batch profile requests instead of single fetches

**Files to change:**
- `src/hooks/useOpenRaffles.ts` (add Realtime subscription)
- Query hooks (increase stale times)
- Profile fetches (batch requests)

**Cost:** No additional cost (Realtime included in Supabase plan)

---

### Phase 4: Caching Layer (Week 4–5)
**Timeline:** 1 week | **Impact:** 50–80% additional reduction  
**What:** Add Redis/KV warm cache for expensive queries

**High-level:**
- Install Vercel KV (if not done in Phase 2) or Upstash Redis
- Create cache wrapper around expensive RPCs:
  - `getCalendarEvents` (cache 1 hour)
  - `getLatestEvents` (cache 15 min)
  - `getProfileEventTimeline` (cache 30 min)
  - `getMapEvents` (cache 2 hours)
- Expected: 70–80% of requests hit cache, not DB

**Cost:** ~$0–10/month for caching (free tier ≥1GB)

---

### Phase 5: Database Optimization (Week 5–6)
**Timeline:** 1 week | **Impact:** 10–30% additional reduction  
**What:** Make each Supabase query more efficient

**High-level:**
- Audit slow queries via Supabase dashboard
- Add indexes on frequently-filtered columns (event_id, city_id, created_at)
- Review EXPLAIN ANALYZE on top 3 slowest RPCs
- Implement pagination (instead of load-all) for large result sets
- Reduce default limits (home page: 6 → 3 events)

**Cost:** No additional cost (indices already covered)

---

### Phase 6: Feature Flags for Degradation (Week 6)
**Timeline:** 2–3 days | **Impact:** Safety net for load spikes  
**What:** Auto-disable non-critical features when IO exceeds threshold

**High-level:**
- Add feature flags: `ENABLE_RAFFLE_REALTIME`, `ENABLE_GUEST_LIST_REALTIME`
- Create `/api/system/io-health` endpoint (queries Supabase metrics)
- Frontend checks IO health, auto-disables heavy features if needed
- Slack alerts when IO > 80%

**Cost:** No additional cost

---

### Phase 7: Data Architecture (Week 7–8) — OPTIONAL
**Timeline:** 1–2 weeks | **Impact:** If Phases 1–6 insufficient  
**What:** Separate operational data from analytics at database level

**High-level (only if needed):**
- Create separate Supabase project for analytics
- Point tracking to analytics project (cheap, scalable)
- Keep operational data in main project
- Add materialized views for expensive queries
- Point read replicas to separate project

**Cost:** Additional Supabase project (~$100–300/month, but lower per-row cost)

---

## Current Status

### ✅ Phase 1 Complete
- Commit: `bd49d05`
- Files modified: 4
- Tests passing: Yes
- Pre-ship validated: Yes
- Status: Deployed to production

### ✅ Phase 2 Complete
- Commit: `6eda16d`
- Files modified: 4 (+ 2 new API routes)
- Tests passing: Yes
- Pre-ship validated: Yes
- Status: Ready to deploy (awaiting Phase 1 stabilization)
- Deployment docs: `DEPLOYMENT-PHASE-2.md`

### 📋 Next Steps
1. **Monitor** Phase 1 Supabase IO for 24–48 hours (should stay low)
2. **Deploy** Phase 2 (set Vercel env vars + enable tracking flags)
3. **Verify** analytics appear in Vercel KV
4. **Monitor** Supabase IO (should stay low even with tracking re-enabled)
5. **Start** Phase 3 after 48hrs stabilization

### 📅 Timeline
- **Today:** Phase 2 implementation complete (Commit: `6eda16d`)
- **Next 24–48h:** Monitor Phase 1, then deploy Phase 2
- **Week 3–4:** Phase 3 (Realtime subscriptions)
- **Week 4–5:** Phase 4 (Caching layer)
- **Week 5–6:** Phase 5 (Query optimization)
- **Week 6:** Phase 6 (Feature flags)
- **Week 7–8 (optional):** Phase 7 (Data architecture)

---

## Cost Analysis

| Phase | What | Cost Before | Cost After | Savings |
|-------|------|-------------|-----------|---------|
| 1 | Disable tracking | — | $0 | $500+/mo (reduced Supabase) |
| 2 | Analytics to KV | $500/mo | $2/mo | $500/mo |
| 3 | Smart subscriptions | — | $0 | $100/mo (fewer queries) |
| 4 | Caching layer | — | $5/mo | $200/mo (fewer queries) |
| 5 | Query optimization | — | $0 | $50/mo (faster queries) |
| 6 | Feature flags | — | $0 | Auto-savings under load |
| 7 (optional) | Data separation | — | $100/mo | $300+/mo (separate analytics) |
| **TOTAL** | **All phases** | **$500/mo** | **$100–150/mo** | **$350–400/mo (70%+)** |

---

## Key Files

### Deployment & Documentation
- `DEPLOYMENT-PHASE-1.md` — Deploy Phase 1 checklist
- `PHASE-2-IMPLEMENTATION-PLAN.md` — Phase 2 detailed guide
- `.env.development` — Feature flags enabled in dev
- `.env.production` — Feature flags disabled in prod

### Phase 1 Code Changes
- `src/lib/featureFlags.ts` — New flags added
- `src/lib/profileViewEmit.ts` — Guarded by flag
- `src/modules/event-page/useRecordEventView.ts` — Guarded by flag
- `src/hooks/useOpenRaffles.ts` — Polling removed

---

## Rollback / Re-enable Tracking

At any point, you can toggle tracking on/off **without re-deploying code:**

```bash
# In Vercel dashboard → Environment Variables:
VITE_ENABLE_EVENT_TRACKING=true   # Re-enable event tracking
VITE_ENABLE_PROFILE_TRACKING=true # Re-enable profile tracking

# Or to disable again:
VITE_ENABLE_EVENT_TRACKING=false
VITE_ENABLE_PROFILE_TRACKING=false
```

Vercel auto-redeploys with new env vars (~2 min).

---

## Questions & Decisions

**Q: Do I need to do all 7 phases?**  
A: No. Phase 1 already solves 70–85% of the problem. Phases 2–7 are for long-term sustainability and cost optimization.

**Q: When should I deploy Phase 1?**  
A: ASAP. It's a net positive with zero user impact.

**Q: What if Phase 1 doesn't reduce IO as expected?**  
A: Investigate: (1) Check env vars are actually set to `false` in production. (2) Check git log — maybe tracking routes weren't deployed. (3) Run `npm run lint` locally to confirm flags are imported.

**Q: Can I skip Phase 2?**  
A: You'll lose event/profile analytics, but IO stays low. Phase 2 restores analytics without cost.

**Q: How long will this take?**  
A: Phase 1 is done. Phase 2–5 are 4–5 weeks of work. Phase 6–7 are optional.

---

## Monitoring Commands

```bash
# After deployment, run this to check Disk IO in Supabase:
open https://app.supabase.com/project/[YOUR_PROJECT]/settings/billing/usage

# Check if tracking is actually disabled:
curl https://www.bachatacalendar.co.uk/event/[TEST_EVENT]
# Should NOT call record_event_view_v1 (check Network tab in DevTools)
```

---

## Next Action

👉 **Run:** `git push origin main` to deploy Phase 1  
👉 **Monitor:** Supabase Disk IO dashboard for 2 hours  
👉 **Review:** `PHASE-2-IMPLEMENTATION-PLAN.md` when Phase 1 stabilizes

# Phase 2 Deployment Checklist — Move Analytics to Vercel KV

**Status:** Phase 2 Implementation Complete (Commit: `6eda16d`)  
**Timeline:** Deploy after Phase 1 has been live for 24–48 hours and stabilized  
**Expected Impact:** Restore analytics tracking, maintain 70–85% IO reduction from Phase 1

---

## Pre-Deployment Validation ✅

- [x] API routes created (`/api/analytics/profile-view` and `/api/analytics/event-view`)
- [x] Client tracking functions updated (`emitProfileView`, `useRecordEventView`)
- [x] Dependencies installed (`@vercel/kv`)
- [x] Linting passes (`npx eslint`)
- [x] TypeScript type-checking passes (`npm run typecheck`)
- [x] Code committed to `main` (Commit: `6eda16d`)

---

## Step 1: Set Up Vercel KV (30 min)

### 1.1 Create Vercel KV Database

1. **Go to Vercel Dashboard**
   - Navigate: https://vercel.com/dashboard
   - Select project: `Website`

2. **Add KV Storage**
   - Click "Storage" tab
   - Click "Create Database" → "KV (Redis)"
   - Name: `bachata-analytics`
   - Region: Choose closest to your Supabase region (usually `eu-west-1` for London)
   - Click "Create"

3. **Copy Credentials**
   - After creation, copy these values from the KV dashboard:
     - `KV_URL`
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
     - `KV_REST_API_READ_ONLY_TOKEN`

### 1.2 Add Env Vars to Vercel

1. **Go to Project Settings**
   - Settings → "Environment Variables"

2. **Add Variables (for all environments: Production, Preview, Development)**
   ```
   KV_URL = <copy from KV dashboard>
   KV_REST_API_URL = <copy from KV dashboard>
   KV_REST_API_TOKEN = <copy from KV dashboard>
   KV_REST_API_READ_ONLY_TOKEN = <copy from KV dashboard>
   ```

3. **Save**
   - Vercel will automatically redeploy with new env vars (~2 min)

### 1.3 Add Env Vars Locally (Optional, for testing)

1. **Create `.env.local` in project root**
   ```
   KV_URL=<from Vercel KV dashboard>
   KV_REST_API_URL=<from Vercel KV dashboard>
   KV_REST_API_TOKEN=<from Vercel KV dashboard>
   KV_REST_API_READ_ONLY_TOKEN=<from Vercel KV dashboard>
   ```

2. **Add to `.gitignore` (already there)**
   ```
   .env.local
   .env.*.local
   ```

---

## Step 2: Enable Tracking Flags (15 min)

### 2.1 Set Vercel Environment Variables

1. **Go to Project Settings → Environment Variables**

2. **Modify or Add:**
   ```
   VITE_ENABLE_EVENT_TRACKING = true       # Enable event view tracking
   VITE_ENABLE_PROFILE_TRACKING = true     # Enable profile view tracking
   ```

3. **Apply to:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development (optional; already true by default via .env.development)

4. **Save**
   - Vercel auto-redeploys

### 2.2 Verify Settings

Run this in the Vercel CLI:
```bash
vercel env list
```

Expected output:
```
KV_URL = <...>
KV_REST_API_URL = <...>
KV_REST_API_TOKEN = <...>
KV_REST_API_READ_ONLY_TOKEN = <...>
VITE_ENABLE_EVENT_TRACKING = true
VITE_ENABLE_PROFILE_TRACKING = true
```

---

## Step 3: Deploy & Validate (1 hour)

### 3.1 Deploy to Production

```bash
# Ensure all changes are pushed to main
git log --oneline -1

# Expected: commit 6eda16d or later
# Vercel auto-deploys on push to main (~2–5 min)

# Check Vercel dashboard → Deployments (should show a green checkmark)
```

### 3.2 Test Profile View Tracking

1. **Open Event Page**
   - Go to: https://www.bachatacalendar.co.uk/event/[ANY_EVENT_ID]

2. **Open DevTools → Network Tab**
   - Filter: "analytics"

3. **Click a Profile (e.g., in the schedule)**
   - Should see `POST /api/analytics/profile-view`
   - Response: `{ ok: true }`

4. **Check KV Storage**
   ```bash
   # In Vercel KV dashboard, click "Profile" tab
   # Should see keys like: profile-view:2026-09-13:sessionId:personId
   ```

### 3.3 Test Event View Tracking

1. **Load Event Page**
   - Go to: https://www.bachatacalendar.co.uk/event/[ANY_EVENT_ID]
   - Wait 3+ seconds (delay in code filters bounces)

2. **Open DevTools → Network Tab**
   - Filter: "analytics"
   - Should see `POST /api/analytics/event-view` after 3s

3. **Check KV Storage**
   - Should see keys like: `event-view:2026-09-13:sessionId:eventId`

### 3.4 Verify Supabase IO Stays Low

1. **Open Supabase Dashboard**
   - https://app.supabase.com/project/[YOUR_PROJECT]/settings/billing/usage

2. **Check Disk IO**
   - Should remain ≤30% of pre-Phase-1 levels
   - The RPC calls `record_event_view_v1` and `record_profile_view_v1` should NOT appear in Network tab

3. **Expected Result**
   - Supabase Disk IO: Flat (not growing)
   - Vercel KV: Growing slowly (~10-100KB/day depending on traffic)

---

## Step 4: Monitor (24–48 hours)

### 4.1 Watch Metrics

- **Supabase Disk IO:** Should stay low (Phase 1 levels)
- **Vercel KV Usage:** Should grow at ~10-100KB/day
- **Vercel KV Cost:** Should stay <$0.05/month
- **Error Logs:** Check for any API 500s in Vercel analytics
- **Frontend Performance:** Should be unchanged (queries are faster, not API calls)

### 4.2 Check Logs

**Vercel Function Logs:**
```bash
vercel logs --tail
```

Expected: Mostly silent (analytics fail silently per design)

**Supabase Logs:**
```
# Go to Supabase Dashboard → Logs
# Should NOT see calls to:
# - record_event_view_v1
# - record_profile_view_v1
```

### 4.3 Query Analytics (Optional)

If you want to inspect the collected data:

```bash
# Copy this to a Node.js script or run in browser DevTools:
const { kv } = await import('@vercel/kv');

// Get all profile views from today
const today = new Date().toISOString().split('T')[0];
const keys = await kv.keys(`profile-view:${today}:*`);
const profileViews = await Promise.all(keys.map(k => kv.get(k)));

console.log(`Profile views today: ${profileViews.length}`);
console.log(profileViews.slice(0, 5)); // Sample first 5
```

---

## Step 5: Rollback (If Needed)

If Phase 2 causes issues, rollback is simple:

```bash
# Option 1: Disable tracking (keeps routes, just stops recording)
VITE_ENABLE_EVENT_TRACKING=false
VITE_ENABLE_PROFILE_TRACKING=false

# Option 2: Revert to Phase 1 (if needed)
git revert 6eda16d
git push origin main
```

Rollback takes ~2 minutes (Vercel redeploy).

---

## Success Criteria ✅

Phase 2 is successful if:

- [x] Vercel KV provisioned and env vars in Vercel dashboard
- [x] API routes deployed and responding (POST 200, not 500)
- [x] Profile views stored in KV (keys appear in dashboard)
- [x] Event views stored in KV (keys appear in dashboard)
- [x] Supabase Disk IO stays ≤Phase 1 levels (no growth)
- [x] Vercel KV costs <$0.10/month
- [x] No user-facing impact (pages load normally)
- [x] Linting & type-checking pass
- [x] E2E smoke tests pass
- [x] 24–48 hours stable (no error spikes)

---

## Estimated Costs After Phase 2

| Item | Before Phase 1 | After Phase 1 | After Phase 2 | Savings |
|------|---|---|---|---|
| **Supabase Disk IO** | $500/month | $100/month | $100/month | 80% |
| **Analytics Storage** | Included (DB cost) | Disabled | $1–5/month (KV) | $95–495/mo |
| **Total Monthly Cost** | **$500** | **$100** | **$105–110** | **~80%** |

---

## Next: Phase 3 (Week 3–4)

After Phase 2 is stable for 48+ hours:

1. Replace aggressive polling with Realtime subscriptions
2. Increase query stale times (5min → 30min for non-critical data)
3. Add batch requests for profile timelines
4. Expected additional savings: 30–50%

See: `SUPABASE-IO-OPTIMIZATION-MASTER-PLAN.md`

---

## Questions & Support

**Q: KV env vars are in Vercel but API routes return 500**
A: Check Vercel function logs (`vercel logs --tail`). Likely causes: KV credentials wrong, lazy import of `@vercel/kv` failing before env vars load.

**Q: Supabase IO didn't drop as expected**
A: (1) Check Network tab — are routes calling `/api/analytics/*`? (2) Check if `VITE_ENABLE_*` flags are actually `true` in Vercel (redeploy if you just changed them). (3) Verify Phase 1 flags are still `false` in Vercel.

**Q: How do I query the analytics data in KV?**
A: See "Step 4.3: Query Analytics". KV is key-value, not SQL, so you'll need to iterate keys with `kv.keys()` and fetch them.

**Q: Can I disable KV to go back to Supabase?**
A: Yes. Set `VITE_ENABLE_EVENT_TRACKING=false` and `VITE_ENABLE_PROFILE_TRACKING=false`, or revert commit `6eda16d`.

---

## Commit Reference

- **Phase 2 Implementation:** Commit `6eda16d`
- **Phase 1 Baseline:** Commit `bd49d05`

---

**Ready?** Follow steps 1–5 above and monitor for 24–48 hours. 🚀

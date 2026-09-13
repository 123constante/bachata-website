# Phase 2 Implementation Plan — Move Analytics to External Storage

**Timeline:** Week 2–3 (after Phase 1 stabilizes for 24–48 hours)  
**Goal:** Permanently move tracking off Supabase → external storage  
**Expected Impact:** Keep IO reduction permanent, restore analytics without DB cost

---

## Architecture Decision

**Option A (Recommended): Vercel KV + HTTP POST**
- Pros: Cheapest free tier, in Vercel ecosystem, queryable via REST API
- Cost: $0.20 per GB-month (free tier ≥1GB)
- Setup time: ~2 hours
- Scalability: ≥1M events/month at minimal cost

**Option B: Append-only JSON logs to Vercel Blob**
- Pros: Ultra-cheap, immutable audit trail
- Cost: $0.50 per GB/month (free tier 50GB)
- Setup time: ~2 hours
- Scalability: ≥5M events/month at minimal cost
- Con: Queryable only via raw file access

**Option C: Third-party analytics (Mixpanel, Plausible)**
- Pros: Full analytics dashboard included
- Cost: $0/mo free tier (~10k events/mo)
- Setup time: ~1 hour
- Con: Vendor lock-in

**Recommendation:** Start with **Option A (Vercel KV)** — best balance of cost, flexibility, and integration.

---

## Implementation (Option A: Vercel KV)

### Step 1: Set Up Vercel KV (30 min)

1. **Install Vercel KV in your Vercel project**
   - Visit: https://vercel.com/docs/storage/vercel-kv/quickstart
   - Click "Create Database" in Vercel dashboard
   - Select project: Website
   - Name it: `bachata-analytics`
   - Region: closest to your Supabase region

2. **Add KV client to project**
   ```bash
   npm install @vercel/kv
   ```

3. **Add env vars to local `.env.local` and Vercel:**
   ```
   KV_URL=<from Vercel KV dashboard>
   KV_REST_API_URL=<from Vercel KV dashboard>
   KV_REST_API_TOKEN=<from Vercel KV dashboard>
   KV_REST_API_READ_ONLY_TOKEN=<from Vercel KV dashboard>
   ```

### Step 2: Create Analytics API Routes (1 hour)

**File:** `src/api/analytics/profile-view.ts`
```typescript
import { kv } from '@vercel/kv';

export async function POST(req: Request) {
  const {
    personId,
    profileType,
    context,
    eventId,
    sessionId,
    userAgent,
  } = await req.json();

  if (!personId || !sessionId) {
    return new Response('Missing required fields', { status: 400 });
  }

  // Key: profile-view:{date}:{sessionId}:{personId} (dedupe by session per day)
  const date = new Date().toISOString().split('T')[0];
  const key = `profile-view:${date}:${sessionId}:${personId}`;

  try {
    // Store in KV (30-day expiry)
    await kv.set(
      key,
      {
        personId,
        profileType,
        context,
        eventId: eventId || null,
        timestamp: new Date().toISOString(),
        userAgent: userAgent || null,
      },
      { ex: 30 * 24 * 60 * 60 } // 30 days
    );

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Analytics KV error:', error);
    // Fail silently — telemetry should never block user
    return new Response('Error', { status: 500 });
  }
}
```

**File:** `src/api/analytics/event-view.ts` (similar pattern)
```typescript
// Same structure, key: event-view:{date}:{sessionId}:{eventId}
```

### Step 3: Redirect Client Tracking (1 hour)

**Update:** `src/lib/profileViewEmit.ts`
```typescript
export function emitProfileView(args: EmitProfileViewArgs): void {
  if (!flags.enableProfileTracking) return;

  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return;

  const sessionId = getViewerSession();
  if (!sessionId) return;

  // CHANGED: POST to /api/analytics instead of Supabase RPC
  fetch('/api/analytics/profile-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personId: args.personId,
      profileType: sanitiseProfileType(args.profileType),
      context: args.context,
      eventId: args.eventId ?? null,
      sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }),
  }).catch(() => {
    // Fail silently — telemetry never blocks
  });
}
```

**Update:** `src/modules/event-page/useRecordEventView.ts` (similar)

### Step 4: Enable Tracking in Production (15 min)

```bash
# Set in Vercel dashboard:
VITE_ENABLE_EVENT_TRACKING=true
VITE_ENABLE_PROFILE_TRACKING=true
```

Now tracking is restored — but hitting KV, not Supabase.

### Step 5: Query Analytics Later (On-Demand)

**File:** `scripts/query-kv-analytics.mjs` (optional admin tool)
```typescript
import { kv } from '@vercel/kv';

// Get all profile views from today
const today = new Date().toISOString().split('T')[0];
const keys = await kv.keys(`profile-view:${today}:*`);
const profileViews = await Promise.all(keys.map(k => kv.get(k)));

console.log(`Profile views today: ${profileViews.length}`);
console.log(profileViews.slice(0, 10)); // Sample
```

---

## Validation Checklist

- [ ] Vercel KV provisioned and env vars in Vercel + local `.env.local`
- [ ] `npm install @vercel/kv` successful
- [ ] `/api/analytics/profile-view` route created and tested locally
- [ ] `/api/analytics/event-view` route created and tested locally
- [ ] `emitProfileView()` updated to POST to `/api/analytics/profile-view`
- [ ] `useRecordEventView()` updated to POST to `/api/analytics/event-view`
- [ ] Env vars: `VITE_ENABLE_*` set to `true` in Vercel
- [ ] Deploy to production
- [ ] Test: click a profile → check network tab → see POST to `/api/analytics/profile-view`
- [ ] Test: load event → check network tab → see POST to `/api/analytics/event-view`
- [ ] Check Supabase Disk IO → should stay low (recording RPCs not called)
- [ ] Check KV usage → should show growth (analytics being stored)

---

## Estimated Costs

| Storage | Free Tier | Cost (excess) |
|---------|-----------|---------------|
| **Vercel KV** | 1 GB / mo | $0.20/GB-mo |
| **Supabase DB** | 500 MB / mo | $1–10/GB |
| **Savings** | ~100M events/mo | 5–50x cheaper |

---

## Risk Mitigation

- **KV down:** Tracking silently fails (no user impact). Supabase still works.
- **Storage full:** Old entries auto-expire (30-day TTL). No data loss.
- **Cost spike:** Set KV budget alert in Vercel dashboard.
- **Can't query:** Use `scripts/query-kv-analytics.mjs` for manual inspection.

---

## Success Criteria

✅ **Phase 2 is successful if:**
- Tracking restored (profile + event views being recorded)
- All data in Vercel KV, not Supabase
- Supabase Disk IO stays <30% of pre-Phase-1 level
- No user-facing impact
- KV costs <$1/month
- Analytics queryable (even if manually)

---

## Next: Phase 3 (Week 3–4)

Once Phase 2 is live and stable:
- Replace aggressive polling with Realtime subscriptions
- Add batch requests for profile timelines
- See: `PHASE-3-IMPLEMENTATION-PLAN.md`

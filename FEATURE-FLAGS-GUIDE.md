# Feature Flags for Supabase IO Optimization

This document explains the tracking-related feature flags added in Phase 1.

## Flags Overview

### `VITE_ENABLE_EVENT_TRACKING`
- **What:** Controls event page view tracking (record_event_view_v1 RPC)
- **Default:** `true` in development, `false` in production
- **When disabled:** Event page views are NOT recorded to Supabase
- **Impact:** ~40–50% IO reduction when disabled
- **How to toggle:**
  ```bash
  # Enable tracking (use analytics)
  export VITE_ENABLE_EVENT_TRACKING=true
  
  # Disable tracking (save IO)
  export VITE_ENABLE_EVENT_TRACKING=false
  ```

### `VITE_ENABLE_PROFILE_TRACKING`
- **What:** Controls profile click tracking (record_profile_view_v1 RPC)
- **Default:** `true` in development, `false` in production
- **When disabled:** Profile clicks are NOT recorded to Supabase
- **Impact:** ~20–30% IO reduction when disabled
- **How to toggle:**
  ```bash
  # Enable tracking (use analytics)
  export VITE_ENABLE_PROFILE_TRACKING=true
  
  # Disable tracking (save IO)
  export VITE_ENABLE_PROFILE_TRACKING=false
  ```

---

## Setup by Environment

### Local Development

**File:** `.env.development` (create if doesn't exist)
```bash
# In dev, we WANT to see tracking work (so keep it enabled)
VITE_ENABLE_EVENT_TRACKING=true
VITE_ENABLE_PROFILE_TRACKING=true
```

**How to test locally:**
```bash
# Start dev server
npm run dev

# Open DevTools → Network tab
# Click on a profile card or load an event page
# Look for POST to `record_event_view_v1` or `record_profile_view_v1`
# Should see the RPC call when flags are true

# To disable locally:
echo "VITE_ENABLE_EVENT_TRACKING=false" >> .env.development
# Restart dev server (npm run dev)
```

### Production

**In Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add/update:
   ```
   VITE_ENABLE_EVENT_TRACKING=false
   VITE_ENABLE_PROFILE_TRACKING=false
   ```
3. Save
4. Redeploy (Vercel auto-triggers)

**Why `false` in production:**
- Tracking disabled = Supabase IO drops 70–85%
- Tracking restored in Phase 2 via Vercel KV (cheaper alternative)
- No user-facing impact

---

## Feature Flag Behavior

### When `VITE_ENABLE_EVENT_TRACKING=true`
```typescript
// src/modules/event-page/useRecordEventView.ts

export function useRecordEventView(eventId, source) {
  useEffect(() => {
    if (!flags.enableEventTracking) return; // SKIPPED if false
    
    // ... calls supabase.rpc('record_event_view_v1', ...)
  }, [eventId]);
}
```

**Network behavior:**
- ✅ Page loads event
- ✅ After 3 seconds, sends `record_event_view_v1` RPC
- ✅ Supabase records the view

### When `VITE_ENABLE_EVENT_TRACKING=false`
```typescript
if (!flags.enableEventTracking) return; // EARLY EXIT, no RPC call

// Code below never runs
// ... calls supabase.rpc(...) — SKIPPED
```

**Network behavior:**
- ✅ Page loads event
- ❌ NO RPC call sent
- ❌ Supabase NOT hit for tracking
- ✅ User sees no difference

**Same for profile tracking** (`VITE_ENABLE_PROFILE_TRACKING`)

---

## How Flags Are Implemented

### featureFlags.ts
```typescript
export const flags = {
  // ... existing flags ...
  
  // NEW in Phase 1:
  enableEventTracking: import.meta.env.VITE_ENABLE_EVENT_TRACKING !== 'false',
  enableProfileTracking: import.meta.env.VITE_ENABLE_PROFILE_TRACKING !== 'false',
} as const;
```

**Logic:**
- If `VITE_ENABLE_EVENT_TRACKING` is NOT set → defaults to `true` (enable)
- If `VITE_ENABLE_EVENT_TRACKING=false` → flag is `false` (disable)
- If `VITE_ENABLE_EVENT_TRACKING=true` → flag is `true` (enable)

### profileViewEmit.ts
```typescript
export function emitProfileView(args) {
  if (!flags.enableProfileTracking) return; // Guard: exit early if disabled
  
  const sessionId = getViewerSession();
  if (!sessionId) return;
  
  // ... calls supabase.rpc('record_profile_view_v1', ...)
}
```

### useRecordEventView.ts
```typescript
export function useRecordEventView(eventId, source) {
  useEffect(() => {
    if (!flags.enableEventTracking) return; // Guard: exit early if disabled
    
    if (!eventId) return;
    
    // ... calls supabase.rpc('record_event_view_v1', ...)
  }, [eventId, source]);
}
```

---

## Toggle Tracking for Testing

### Quick toggle (without changing env vars)

**Goal:** Test with/without tracking in the same session

**Approach:** Edit `src/lib/featureFlags.ts` temporarily
```typescript
// For testing: force-disable tracking
export const flags = {
  // ...
  enableEventTracking: false, // ALWAYS disabled for testing
  enableProfileTracking: false, // ALWAYS disabled for testing
} as const;
```

Then:
- npm run dev
- Open DevTools → Network
- Load event page → NO `record_event_view_v1` RPC
- Click profile card → NO `record_profile_view_v1` RPC

**Don't commit this change** — it's test-only.

---

## Phase 1 vs Phase 2+

### Phase 1 (Current)
- Tracking **disabled** in production via feature flags
- Tracking **enabled** in development
- RPCs NOT called → Supabase IO drops 70–85%
- Analytics data is **LOST** (none recorded)

### Phase 2 (Week 2–3)
- Tracking **redirected** to Vercel KV (external storage)
- Same user behavior, but analytics go to cheap KV instead of expensive Supabase
- Feature flags stay, but `enableEventTracking=true` calls `/api/analytics/event-view` instead of Supabase RPC
- Supabase IO stays low, analytics restored

### Phase 3+
- Further optimizations (caching, subscriptions, queries)
- Feature flags remain as safety net for graceful degradation

---

## Troubleshooting

### "Tracking is enabled but I don't see RPC calls"

**Check 1:** Is the flag actually imported in the file?
```bash
grep -n "import.*flags" src/lib/profileViewEmit.ts
grep -n "import.*flags" src/modules/event-page/useRecordEventView.ts
```
Should show: `import { flags } from '@/lib/featureFlags';`

**Check 2:** Is the guard actually there?
```bash
grep -n "if (!flags.enable" src/lib/profileViewEmit.ts
grep -n "if (!flags.enable" src/modules/event-page/useRecordEventView.ts
```
Should show early-return guards.

**Check 3:** Is the env var actually set?
```bash
echo "Event tracking flag:" $VITE_ENABLE_EVENT_TRACKING
echo "Profile tracking flag:" $VITE_ENABLE_PROFILE_TRACKING

# Or check in browser DevTools console:
# fetch('/.env' will NOT work — env vars are only in build)
# Instead check Network tab — look for record_*_view_v1 RPC calls
```

### "I toggled the flag but changes didn't take effect"

**Solution:** Restart dev server or redeploy to Vercel
```bash
# Local dev:
npm run dev
# (Ctrl+C to stop, then re-run)

# Vercel prod:
# Go to https://vercel.com/dashboard
# Click project → Deployments → click latest → Redeploy
```

---

## Re-enable Tracking (Rollback)

If you need to restore tracking before Phase 2 is ready:

```bash
# Method 1: In Vercel dashboard
# Go to Settings → Environment Variables
# Set: VITE_ENABLE_EVENT_TRACKING=true
# Set: VITE_ENABLE_PROFILE_TRACKING=true
# Wait for auto-redeploy (~2 min)

# Method 2: Local testing
# Edit .env.development:
VITE_ENABLE_EVENT_TRACKING=true
VITE_ENABLE_PROFILE_TRACKING=true
# Restart: npm run dev
```

Supabase IO will spike back to pre-Phase-1 levels until Phase 2 is deployed.

---

## Questions?

See: `SUPABASE-IO-OPTIMIZATION-MASTER-PLAN.md`

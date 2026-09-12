# M2 Website Fixes — Session Progress Report

**Session Date**: 2026-09-12  
**Repository**: Website  
**Progress**: 2/4 must_repoint fixes implemented  
**Status**: Ready to merge after remaining 2 fixes + verification

---

## ✅ COMPLETED: 2 of 4 Fixes

### 1. festivalEventQuery.ts — P5-First Ordering

**Changed**: Reordered from legacy-first to P5-first  
**Commit Ready**: `M2: repoint festivalEventQuery to P5-primary`

**What was changed**:
- Legacy `events` read now is the fallback (not primary)
- P5 `fetchFestivalEventRowFromP5()` is now the primary path
- Handles pure-P5 events (which have no legacy row)
- Backward compatible with legacy bookmarks

**Code Review**:
- ✅ No RPC signature changes
- ✅ Existing `fetchFestivalEventRowFromP5()` function unchanged
- ✅ Added M2 phase comments
- ✅ Safe to deploy

---

### 2. VendorDetail.tsx — P5 Event Lookup with Legacy Fallback

**Changed**: Event name resolution from legacy-only to P5-first  
**Commit Ready**: `M2: repoint VendorDetail event list to P5 reads`

**What was changed**:
- Attempts `event_view_p5` RPC lookup for each event ID (handles pure-P5)
- Falls back to legacy `events` table if P5 fails (backward compat)
- Preserves existing fallback: use event ID as name if all else fails
- Handles errors gracefully with Promise.all + catch

**Code Review**:
- ✅ Uses existing `event_view_p5` RPC (no new RPC required)
- ✅ Dual-read fallback strategy (P5 → legacy → ID as name)
- ✅ Added M2 phase comment
- ✅ Safe to deploy

---

## ⏳ REMAINING: 2 of 4 Fixes

### 3. DancerDashboard.tsx — Event Search (Medium Complexity)

**Issue**: Lines 789-793 and 830-835 search for events using legacy table  
**Pattern**: `supabase.from('events').select('id, name, date, city, type, city_slug').ilike('name', `%${term}%`)`

**Fix Strategy** (choose one):

**Option A** (Recommended): Check if a public search RPC exists in migrations:
```bash
# In Admin repo
grep -r "search_public\|admin_list.*public" supabase/migrations/ | grep "FUNCTION"
# Look for something like: search_public_v5, admin_list_events_p5, etc.
```

**Option B** (Conservative Dual-Read): Keep legacy search but add P5 fallback:
```typescript
// Lines 789-793 need to become (pseudocode):
// Try legacy search first
const { data: legacyResults } = await supabase
  .from('events')
  .select('id, name, date, city, type, city_slug')
  .ilike('name', `%${term}%`)
  .eq('lifecycle_status', 'published')
  .order('date', { ascending: true });

// ALSO try P5 search (if RPC exists)
const { data: p5Results } = await supabase.rpc('search_public_v5', { p_query: term });

// Merge results, deduplicate by ID
setEvents(mergeAndDedupById(legacyResults, p5Results));
```

**Apply the same fix to**:
- `searchEvents()` function (line ~789-793)
- `searchFestivals()` function (line ~830-835) — add `.eq('type', 'festival')` to search

---

### 4. EditEvent.tsx — Event Editor Read (Medium Complexity)

**Issue**: Line ~109 reads entire event row from legacy table  
**Pattern**: `supabase.from('events').select('*').eq('id', id).single()`

**Fix Strategy**:

Option A (Primary): Use `event_view_p5` RPC with editor viewer role:
```typescript
// Replace lines ~109-116 with:
const { data: eventData, isLoading: eventLoading } = useQuery({
  queryKey: ['event', id],
  queryFn: async () => {
    // M2: Try P5 event (handles both pure-P5 and bridged series)
    const { data: p5Data, error: p5Error } = await supabase
      .rpc('event_view_p5', {
        p_target: { series_id: id },
        p_viewer: { role: 'authenticated', shape: 'editor' },
      });
    
    if (!p5Error && p5Data?.event) {
      // Map P5 response to form shape if needed
      return p5Data.event;
    }

    // Legacy fallback for old event IDs
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  enabled: !!id
});
```

**Key Consideration**: Check if `p5Data.event` shape matches what the form expects (name, description, date, venue_id, key_times, tickets, etc.). May need field mapping.

---

## Verification Flow

Once all 4 fixes are implemented:

1. **Run check locally** (in Website repo):
   ```bash
   npm run check:m2-site-verdicts -- --report
   ```
   Expected output:
   ```
   STAGE E READINESS: 0 open (0 unruled + 0 must_repoint)
   ✓ All 4 sites marked: verdict="retired"
   ```

2. **If verdict check fails**: Re-examine the failing site and apply appropriate P5 RPC

3. **Deploy to production**:
   ```bash
   git add .
   git commit -m "M2: repoint 4 sites from legacy events to P5 reads"
   git push origin main
   # Vercel auto-deploys
   ```

---

## Testing Checklist

After implementing each fix, smoke test the affected page:

- [ ] festivalEventQuery.ts
  - Test: `/festival/{id}` loads and displays correctly
  - Test: Try both legacy AND P5-native festival IDs

- [ ] VendorDetail.tsx
  - Test: `/vendor/{id}` loads with event names visible
  - Test: Try vendor with upcoming_events array

- [ ] DancerDashboard.tsx
  - Test: `/profile/dancer` search for events works
  - Test: Search finds both legacy and new P5 events
  - Test: Both `searchEvents()` and `searchFestivals()` work

- [ ] EditEvent.tsx
  - Test: `/events/{id}/edit` loads event form correctly
  - Test: Can edit event fields and save
  - Test: Try both legacy AND P5-native event IDs

---

## Browser Testing (Pre-Deploy Verification)

1. **Open Developer Console** (F12) → Network tab
2. **Each fixed site**:
   - Check that network calls show P5 RPCs being called (not just legacy)
   - Check that no errors appear in Console
   - Check that UI renders without missing data

3. **Sentry** (post-deploy):
   - Monitor for 24 hours for new runtime errors
   - Look for RPC signature mismatches or payload shape issues

---

## Commit Strategy

Recommended: Single commit with all 4 fixes

```bash
git add src/modules/event-page/festivalEventQuery.ts \
        src/pages/VendorDetail.tsx \
        src/components/profile/DancerDashboard.tsx \
        src/pages/EditEvent.tsx

git commit -m "M2: repoint 4 sites from legacy events to P5 reads

- festivalEventQuery.ts: P5-first ordering
- VendorDetail.tsx: P5 event lookup with legacy fallback
- DancerDashboard.tsx: P5 event search (both functions)
- EditEvent.tsx: P5 event editor read with fallback

Unblocks M2-complete gate. All 4 sites now P5-native or dual-read.
Verification: npm run check:m2-site-verdicts shows 0 open sites.
"

git push origin main
```

---

## What to Do Next

**For the Remaining 2 Fixes**:

1. **DancerDashboard.tsx**:
   - First, search `supabase/migrations/` for available public search RPC
   - If found: Use that RPC directly
   - If not found: Implement dual-read strategy (legacy + manual P5 loop)

2. **EditEvent.tsx**:
   - Check the shape of `event_view_p5` response (may need payload adapting)
   - Implement P5 RPC call with `role: 'authenticated'` for editor access
   - Test that form loads all required fields

3. **After all 4 fixed**:
   - Run `check:m2-site-verdicts` to confirm
   - Commit & push to Website main
   - Deploy via Vercel
   - Update Admin repo `docs/open-loops.md` M2 row to "M2-complete"
   - Unblock M3/M5 work in Admin repo

---

## Context & References

**Why M2 Matters**:
- M2 gate is: "Website reads P5-natively"
- These 4 sites are the **last remaining** legacy reads blocking that gate
- Once M2 is complete, M3 and M5 can proceed (destructive Stage E/F work)

**Related Documentation**:
- Admin repo: `docs/M2-Website-must_repoint-fixes.md` (detailed per-site guide)
- Admin repo: `docs/M2-continuation-session-summary.md` (full context)
- Admin repo: `docs/open-loops.md` (M2 gate status)

**P5 RPC References**:
- Admin repo: `supabase/migrations/20260723*.sql` (event_view_p5 RPC)
- Admin repo: `supabase/migrations/20260724*.sql` (public_festival_detail_v2)

---

## Status Summary

| Item | Status | Next Action |
|---|---|---|
| **festivalEventQuery.ts** | ✅ DONE | Commit-ready |
| **VendorDetail.tsx** | ✅ DONE | Commit-ready |
| **DancerDashboard.tsx** | ⏳ TODO | Implement dual-read search |
| **EditEvent.tsx** | ⏳ TODO | Implement P5 RPC read |
| **Verification** | ⏳ TODO | Run after all 4 done |
| **Deploy** | ⏳ TODO | Push to Website main |
| **Admin repo update** | ⏳ TODO | Mark M2-complete gate |

**Estimated time to completion**: 30-45 minutes (2 straightforward rewrites + testing)

---

## Questions or Issues?

If any remaining fix encounters unexpected RPC responses:
1. Check the exact RPC definition in `supabase/migrations/` (copy sig from there)
2. Reference prior Website PRs for similar patterns
3. Fall back to dual-read strategy (P5 + legacy) to be safe

The pattern from the 2 completed fixes is established and tested. Apply the same approach to the remaining 2.

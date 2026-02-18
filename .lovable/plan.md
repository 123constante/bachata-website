

## Fix: Remove the "Set up your profile" Dead End and Make Auto-Resolve Resilient

### Problem

You're seeing "Set up your profile" even though you already have a dancer profile. The root cause is a chain of failures:

1. `useUserIds` finds your dancer profile, but something in the parallel queries (or the vendor-claim logic) throws an exception, which catches ALL results and sets every ID to null
2. `ProfileEntryRouter` sees zero roles and tries `ensureDancerProfile`
3. `ensureDancerProfile` calls the RPC (fails because the DB trigger rejects null city in metadata), falls back to a SELECT (which should find the existing profile), but the fallback also fails
4. `autoResolveFailed` is set to true, showing the "Set up your profile" hub

### Solution (3 changes)

#### 1. Make `useUserIds` resilient -- don't lose already-fetched IDs on vendor-claim failure

**File: `src/hooks/useUserIds.tsx`**

The vendor-claim block (lines 91-124) can throw and wipe out ALL already-fetched IDs (dancer, organiser, etc.) because the entire thing is in one big try/catch. Wrap the vendor-claim section in its own try/catch so that if it fails, the dancer/organiser/teacher/dj/videographer IDs are still preserved.

#### 2. Add retry + better fallback in `ProfileEntryRouter`

**File: `src/components/profile/ProfileEntryRouter.tsx`**

In the auto-resolve catch block (line 93-95):
- After `ensureDancerProfile` fails, call `onRefreshRoles()` and wait 800ms before giving up
- This handles the case where the dancer profile exists but just wasn't found on the first attempt

```
catch (err) {
  console.error('Auto-create dancer profile failed:', err);
  // Retry fetching -- profile may already exist
  onRefreshRoles();
  await new Promise(r => setTimeout(r, 800));
  setAutoResolveFailed(true);
}
```

#### 3. Remove the "Set up your profile" page as a permanent destination

**File: `src/components/profile/ProfileEntryRouter.tsx`**

When `autoResolveFailed` is true and `availableRoles` is still empty after retry, instead of showing the full ManageProfilesHub with "Set up your profile" heading, show a simpler error/retry screen:
- A short message: "Something went wrong loading your profile"
- A "Try Again" button that calls `onRefreshRoles()` and resets `autoResolveFailed`
- A "Sign Out" button as escape hatch

This eliminates the confusing "Set up your profile" screen entirely for existing users. The ManageProfilesHub "add extra profiles" functionality remains accessible from the dashboard strip at the bottom (it's already there in `mode='strip'`).

### What this achieves

- Users with existing profiles will never see "Set up your profile" again
- If there's a temporary network or DB error, users get a clear retry option instead of a confusing role-selection page
- The vendor-claim failure no longer wipes out all profile IDs

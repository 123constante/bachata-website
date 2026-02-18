

## Logic Refinement: localStorage Clearing Order and Fallback Safety

Two targeted adjustments to the previously approved auth flow plan. No UI, styling, database, or RLS changes.

### Adjustment 1: Clear localStorage AFTER Navigation Decision

In both `AuthCallback.tsx` and `Onboarding.tsx`, the order of operations must be strictly:

```text
1. Read pendingRole from localStorage
2. Decide route based on pendingRole
3. Navigate to chosen route
4. Clear localStorage keys (pending_profile_role, profile_entry_role, etc.)
```

This applies to:

**AuthCallback.tsx** -- when dancer EXISTS and pendingRole is set:
```text
const pendingRole = localStorage.getItem("pending_profile_role")
// decide route
if (pendingRole && pendingRole !== "dancer") {
  navigate(`/create-${pendingRole}-profile`, { replace: true })
} else {
  navigate("/profile", { replace: true })
}
// clear AFTER navigate call
localStorage.removeItem("pending_profile_role")
```

**Onboarding.tsx** -- post-submission navigation:
```text
const pendingRole = localStorage.getItem("pending_profile_role")
// decide route
if (pendingRole && pendingRole !== "dancer") {
  navigate(`/create-${pendingRole}-profile`, { replace: true })
} else {
  navigate("/profile", { replace: true })
}
// clear AFTER navigate call
localStorage.removeItem("pending_profile_role")
localStorage.removeItem("profile_entry_role")
localStorage.removeItem("auth_signup_draft_v1")
localStorage.removeItem("auth_last_email")
localStorage.removeItem("profile_last_active_role")
```

### Adjustment 2: Safety Fallback in AuthCallback

Add a catch-all case for when no dancer exists AND no pending role is found. This protects against cleared localStorage, manual URL visits, or disabled browser storage.

**Updated AuthCallback decision tree:**

```text
1. Wait for authenticated user
2. Query: SELECT id FROM dancers WHERE user_id = auth.uid()
3. Read: pendingRole = localStorage.getItem("pending_profile_role")

IF dancer EXISTS:
  IF pendingRole AND pendingRole !== "dancer":
    -> navigate("/create-{pendingRole}-profile")
    -> clear pending_profile_role
  ELSE:
    -> navigate("/profile")
    -> clear pending_profile_role (if set)

IF dancer DOES NOT EXIST:
  -> navigate("/onboarding")
  (keep pending_profile_role for onboarding to read later)
  This fires regardless of whether pendingRole exists or not.
```

The key addition: the "no dancer" path always goes to `/onboarding`, even if `pendingRole` is null. The onboarding page handles both cases -- if a role is remembered it routes accordingly after submission, if not it defaults to `/profile`.

### Files Affected

| File | What Changes |
|------|-------------|
| `src/pages/AuthCallback.tsx` | Move localStorage clear after navigate; add fallback for no-dancer + no-role |
| `src/pages/Onboarding.tsx` | Move localStorage clear after navigate |

All other files from the previous plan remain unchanged. No database, trigger, RLS, or styling modifications.


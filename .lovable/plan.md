

## Problem

When a signed-in user visits `/profile` and has **no profiles yet** (e.g., fresh signup), `ProfileEntryRouter` shows the `ManageProfilesHub` in full "card" mode -- a big "Choose your role" screen listing all 6 roles. This is redundant because:

1. The user **already chose a role** during the signup flow (`ProfileEntryFlow`) -- stored in `localStorage` as `profile_entry_role`
2. A dancer profile should have been auto-created via `ensureDancerProfile` during signup, but timing issues or errors can cause `useUserIds` to return empty on the first render

The result is a confusing duplicate role-selection screen.

## Proposed Solution

Streamline the zero-roles state in `ProfileEntryRouter` so that instead of showing the full role picker, it:

1. **Checks `localStorage` for `profile_entry_role`** -- if the user already chose a role during signup, auto-redirect them to the appropriate create-profile page (e.g., `/create-dancers-profile`, `/create-organiser-profile`)
2. **If no stored role exists**, auto-create a dancer profile (the default/base role) using `ensureDancerProfile`, then refresh roles -- the user lands directly on the Dancer Dashboard
3. **Only show the ManageProfilesHub role picker as a fallback** if both of the above fail

This eliminates the redundant "Choose your role" screen entirely for the normal flow.

## Technical Details

### File: `src/components/profile/ProfileEntryRouter.tsx`

**Changes:**
- Import `ensureDancerProfile` and `useAuth` (to get user details for auto-creation)
- In the `availableRoles.length === 0` branch (lines 82-96):
  - Add a `useEffect` that runs once when `availableRoles` is empty and user is authenticated:
    1. Read `profile_entry_role` from `localStorage`
    2. If a role is stored and it's not `dancer`, navigate to the corresponding create-profile page (e.g., `/create-organiser-profile`) and clear the stored role
    3. If the role is `dancer` or no role is stored, call `ensureDancerProfile()` with the user's info, then call `onRefreshRoles()` to re-fetch IDs -- this will cause the component to re-render with `dancerId` populated, skipping the zero-roles state entirely
    4. If everything fails, fall through to showing `ManageProfilesHub` as before
  - Show a loading spinner during this auto-resolution instead of the role picker
  - Add a route map constant for role-to-create-page mapping

### Route Map

```text
dancer     -> auto-create via ensureDancerProfile (no redirect needed)
organiser  -> /create-organiser-profile
teacher    -> /create-teacher-profile
dj         -> /create-dj-profile
videographer -> /create-videographer-profile
vendor     -> /create-vendor-profile
```

### Edge Cases

- If `ensureDancerProfile` fails (network error, RLS issue), fall back to showing ManageProfilesHub
- Clear `profile_entry_role` from localStorage after consuming it to prevent redirect loops
- If user navigates directly to `/profile` without going through signup (no stored role), auto-create dancer profile as the sensible default


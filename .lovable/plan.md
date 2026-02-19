

## Fix: Add Profile Flow for Authenticated Users

### Problem
When an already signed-in user clicks "Create" on a new role (e.g., Organiser, Teacher, DJ) from the Manage Profiles hub, they are incorrectly redirected to the Auth/signup page instead of going straight to the role creation form. This breaks the "add multiple profiles under one account" flow.

### Root Cause
In `src/components/profile/ManageProfilesHub.tsx`, the `handleCreateRole` function (line 182-186) always navigates to `/auth?mode=signup`, regardless of whether the user is already authenticated.

### Fix

**`src/components/profile/ManageProfilesHub.tsx`** -- Update `handleCreateRole` to check authentication status:
- If the user is already signed in, navigate directly to the role creation page (e.g., `/create-organiser-profile`, `/create-teacher-profile`, etc.)
- Only redirect to `/auth` if the user is not authenticated (edge case/fallback)

The role-to-route mapping already exists in the codebase via the `ROLE_CREATE_ROUTES` constant at the top of the file (line 22-28). The fix simply uses this map when the user is authenticated.

### Technical Detail
```
Current (broken):
  handleCreateRole -> always navigates to /auth?mode=signup

Fixed:
  handleCreateRole -> if user exists, navigate to /create-{role}-profile
                   -> if no user, navigate to /auth (fallback)
```

### What Already Works (no changes needed)
- Each Create*Profile page already detects authenticated users and skips to the form (step 1)
- Each page checks for duplicate profiles and redirects if one already exists
- ProfileSelector handles switching between roles
- useUserIds fetches all role IDs and triggers re-render when a new profile is created
- The `onRefreshRoles` callback reloads IDs after profile creation

### Result
Authenticated users can seamlessly add new role profiles (Organiser, Teacher, DJ, Videographer, Vendor) from their profile page without being sent through the auth flow again.

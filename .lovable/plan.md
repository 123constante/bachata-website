

## Align MobileBottomNav Auth Modal with the New Signup Flow

### Problem
The modal auth dialog in `MobileBottomNav` (triggered when an unauthenticated user taps the Profile tab) has two issues:

1. **Broken signups**: The "Create account" tab sends `signInWithOtp` without `first_name` or `city` in the metadata. The database trigger `enforce_required_user_metadata` rejects accounts missing these fields, so every signup from this modal fails with a 500 error.

2. **Inconsistent UX**: The Auth page now uses a clean 3-step wizard (Role -> Name/City -> Email), but the modal still shows role list + email on one screen with no name or city collection.

### Solution
Redesign the modal's signup tab to match the Auth page wizard pattern -- a multi-step flow inside the dialog that collects role, first name, city, and email before sending the magic link.

### Changes

**`src/components/MobileBottomNav.tsx`** -- Rework the signup tab inside the existing Dialog:

**New state variables:**
- `signupStep`: 1 | 2 | 3 (role -> name/city -> email)
- `firstName`: string
- `city`: string

**Step 1 -- Role Selection** (replaces current role list + email on one screen)
- Same role buttons as today, but with a "Continue" button instead of jumping straight to email
- Hint text: "Choose your role, then enter your details."

**Step 2 -- Name and City**
- First name input (required, with User icon)
- CityPicker component (required, autocomplete from cities table)
- "Continue" button (disabled until both fields filled)
- "Back" button to return to step 1

**Step 3 -- Email**
- Email input (same as today)
- "Send magic link" button (disabled until valid email)
- "Back" button to return to step 2

**Fix the `signInWithOtp` call** to include metadata:
```
data: {
  user_type: selectedRole,
  first_name: firstName.trim(),
  city: city.trim()
}
```

**Sign-in tab** stays exactly as-is (single email field + send link).

**Reset behavior**: When switching between tabs or closing/reopening the modal, reset `signupStep` back to 1.

### What Stays the Same
- The Dialog component and its open/close behavior
- The sign-in tab (email + magic link, unchanged)
- The MagicLinkConfirmation screen after sending
- Dev tools (quick login, random account)
- The bottom nav bar itself
- All AuthCallback and backend logic

### Result
- Signups from the modal will include all required metadata and succeed
- The UX matches the full Auth page wizard pattern
- Users complete role + name + city + email before the magic link is sent

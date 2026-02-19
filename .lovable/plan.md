

## Ensure Only Fully Onboarded Users Exist

### The Problem
The main Auth page (`/auth`) signup flow only collects **role + email** before sending the magic link. But a database trigger (`enforce_required_user_metadata`) requires `first_name` and `city` to be present when the user account is created. This causes every new signup from the Auth page to fail with a 500 error.

Meanwhile, the AuthStepper component (used in ProfileEntryFlow) already collects first name, surname, and city before sending the code -- so it works correctly.

### The Solution
Update the Auth page signup form to collect **first name** and **city** before sending the magic link, just like AuthStepper does. All required data gets bundled into the magic link request, so the account is complete from the moment it's created. No incomplete accounts will ever exist.

### What Changes

**1. `src/pages/Auth.tsx` -- Add name and city fields to signup form**
- Add `firstName` and `city` state variables
- Add first name input field (with User icon) below the role picker
- Add city input field using the existing `CityPicker` component (autocomplete from the cities table)
- Validate both fields before allowing the magic link to be sent
- Include `first_name` and `city` in the `data` option of `signInWithOtp()` so they're stored as user metadata
- The "Send magic link" button stays disabled until all fields are filled

**2. `src/pages/AuthCallback.tsx` -- Use metadata to auto-create dancer profile**
- When a new user arrives (no dancer profile exists), use metadata from `user.user_metadata` (first_name, city) to create the dancer profile automatically via `ensureDancerProfile`
- If the profile is created successfully and the user had a pending non-dancer role, route them to the appropriate role creation page
- If profile creation succeeds with a dancer-only role, route to `/profile`
- This eliminates the need for the separate `/onboarding` page for users coming from the Auth page, since all data was already collected

**3. No database changes needed**
- The `enforce_required_user_metadata` trigger stays in place -- it correctly ensures completeness
- The `ensure_dancer_profile` RPC already handles profile creation with the metadata

### User Flow After This Change

1. User visits `/auth` and selects "Create account"
2. They pick a role (Dancer, Organiser, etc.)
3. They enter their **first name**, select their **city**, and enter their **email**
4. They click "Send magic link" -- the link is sent with all metadata attached
5. They click the link in their email
6. AuthCallback creates the dancer profile automatically using the metadata
7. They land on `/profile` or the appropriate role creation page -- fully onboarded

### Technical Details
- The `CityPicker` component (already exists at `src/components/ui/city-picker.tsx`) provides autocomplete against the `cities` table via the `search_cities` RPC
- The `signInWithOtp` call will include `data: { user_type, first_name, city }` for new signups
- AuthCallback will call `ensureDancerProfile({ userId, email, firstName, city })` before routing
- The Onboarding page remains as a fallback for edge cases (e.g., users who signed up via AuthStepper or other entry points)


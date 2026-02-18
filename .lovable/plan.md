

## Enforce Email + First Name + City as Minimum Profile Requirements

### Problem
Currently, the signup flow (`AuthStepper`) only collects **email** and **first name**. City is never asked during registration. This means profiles get created without a city, which breaks the "minimum requirement" rule: every profile needs an email, a first name, and a city.

### Solution
Add a **city field** to the signup "name" step in `AuthStepper`, and enforce all three fields throughout the profile creation pipeline.

### Changes

#### 1. `src/components/auth/AuthStepper.tsx` -- Add city to the "name" step

- Add a new `city` state variable (empty string default)
- Add a `fieldErrors.city` validation entry
- In the `stage === "name"` section (lines 466-516), add a `CityPicker` component below the surname field, labeled "Your city" (required)
- Update the "Continue" button validation (line 502) to also check that `city` is non-empty
- In `handleSendCode` (line 216), also validate city is set
- Pass `city` into `signInWithOtp` metadata alongside `first_name` and `surname`:
  ```
  data: {
    first_name: trimmedFirstName,
    surname: trimmedSurname || null,
    city: city.trim(),
    user_type: userType,
  }
  ```
- Update `totalSteps` -- no change needed since city is collected on the same "name" step

#### 2. `src/lib/ensureDancerProfile.ts` -- Require city for new inserts

- Before creating a new dancer (the INSERT at line 79), check that `safeCity` is non-null. If city is missing, throw an error: `"City is required to create a profile"`
- The existing update path (line 61) remains unchanged -- it just backfills missing fields on existing profiles
- The RPC path remains unchanged (the DB function handles its own validation)

#### 3. `src/components/profile/ProfileEntryRouter.tsx` -- Pass city from user metadata

- The auto-resolve `useEffect` (line 84-91) already passes `city: typedUser.user_metadata?.city || null` -- this will now work because city is collected during signup and stored in user metadata. No code change needed here.

#### 4. `src/components/auth/ProfileEntryFlow.tsx` -- Pass city when calling ensureDancerProfile

- In `handleRoleContinue` (line 137-148), the call to `ensureDancerProfile` already passes `metadataCity`. Since city is now in user metadata from signup, this will work automatically. No change needed.

### What the user experiences

1. **Sign up** -- after entering email and first name, they now also pick their city (using the existing `CityPicker` component) on the same step
2. **Profile is created** with all three required fields populated
3. **No more "Set up your profile" fallback** screen caused by missing city triggering the database trigger

### Edge cases
- Returning users (login flow) skip the name/city step entirely -- no change
- Existing profiles with NULL city are not affected (the update path backfills but doesn't block)
- The `CityPicker` component already exists and handles city search/selection

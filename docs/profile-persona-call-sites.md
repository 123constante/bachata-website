# "My profile" call sites &mdash; the resolved persona (slice 2)

An account can be LINKED to an admin-made dancer profile (`dancer_profiles.claimed_by`).
The server's `_my_dancer_profile_id_v1()` is the one answer to "which profile is mine":
the live linked profile, else the account's own row (the sign-up stub), else NULL.

**One client mapping:** `src/lib/myPersona.ts`.

| Helper | Meaning |
| --- | --- |
| `fetchMyPersonaId()` | one raw call; throws when the call fails, NULL = no persona |
| `myPersonaIdForReads(queryClient, accountId)` | through the per-account react-query cache (`["my-persona-id", accountId]`, 5 min) |
| `personaIdForReads` | resolved &rarr; that id; NULL &rarr; no row (the screen's existing "no row" path); **call failed &rarr; the account id** (what every screen read before, so an outage degrades to the old behaviour) |
| `isMyProfile` | viewed id = my persona **or** my account id (an archived stub URL is still mine) |
| `useMyPersonaId()` | the same cache, as a hook |

## Call sites

| File | What | Now |
| --- | --- | --- |
| `src/components/auth/AuthGuard.tsx` | onboarding gate | reads the persona |
| `src/hooks/useUserIds.tsx` | `dancerId`, `dancerProfileComplete`, and the persona-keyed teacher role and vendor match | reads the persona |
| `src/pages/Profile.tsx`, `src/components/profile/VendorDashboard.tsx` | inherit `dancerId` from `useUserIds` | no edit needed |
| `src/pages/EditProfile.tsx` | form load | reads the persona |
| `src/components/profile/DancerDashboard.tsx` | dashboard load | reads the persona |
| `src/pages/PracticePartners.tsx` | "my profile" for matching | reads the persona |
| `src/pages/DancerProfile.tsx` | `isSelfView` | `isMyProfile` |
| `src/hooks/useProfileCompletion.ts` | completeness (#707) | the shared resolver, through the cache |
| `src/pages/AuthCallback.tsx` | sign-in fill (#707) | the shared resolver (fresh, after the claim) |

**Writes:** every one goes through `save_my_dancer_profile_v1` (EditProfile, DancerDashboard x2,
PracticePartners, AuthCallback, FinishProfile, Onboarding), which resolves the persona on the
server (`resolve_my_person_id_v1`). There is no direct `dancer_profiles` update keyed on the auth id.

**Left as is, deliberately:** `useEventPermissions` (`profiles.is_admin`, an account-level
table); `videographers` / `vendors` `.eq("user_id", user.id)` (account-level ownership);
`get_my_event_attendance_v2` (resolved on the server).

**Not routed today:** `EditProfile`, `Profile` (and so `DancerDashboard` and `VendorDashboard`
through `ProfileEntryRouter`) have no route importer. They were moved anyway so they are right
if they are routed again.

## Self-claim at sign-in

`src/lib/claimMyDancerProfile.ts` calls `claim_my_dancer_profile_v1()` (admin contract) from
`/auth/callback` and from AuthStepper's in-page sign-in, once per sign-in, on **every** sign-in,
before the persona is read. It never rejects (a missing function, an error, a 4 s hang are all
"unavailable"). On `linked` it invalidates `my-persona-id` and `profile-completion`, and the
one-time finish-profile hop is not armed for that sign-in.

## Server rating gate

`rate_series_level_p5_v1` RAISEs `profile_incomplete` for an incomplete persona. 
`useSeriesLevelRating` maps it to `held`: the vote is stashed (`pendingLevelRating`), the
completion cache is dropped, and the card shows the same "Finish your profile to rate" gate
(`refusedGateFor` on the `ProfileGateContext` value, so `/event/:id` imports nothing new).

Tests: `src/lib/__tests__/myPersonaSurfaces.test.tsx`, `src/lib/__tests__/claimMyDancerProfile.test.ts`,
`src/pages/__tests__/SignInSelfClaim.test.tsx`, `src/components/__tests__/LevelRatingServerGate.test.tsx`.

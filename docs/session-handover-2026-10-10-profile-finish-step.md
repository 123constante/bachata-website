# Session handover &mdash; 2026-10-10 &mdash; profile finish step (Website)

Branch: `claude/feat/website-profile-finish-step` (one push). PR: opened by `bot-pr.yml`; number in the PR list / final session message.

## Done (all in the branch)

1. **Sign-up asks the dance role** on `/auth` (details step) and in `AuthStepper` (name step). Required. Sends the exact stored value (`Leader` / `Follower` / `Lead and Follow`, read off `dancer_profiles_dance_role_check` on prod) as `dance_role` in the sign-up metadata. `/auth/callback` writes it to the stub with the name and city through the existing `save_my_dancer_profile_v1` path (only a value the column admits). No admin change needed. Gap from before this change: AuthStepper's typed-code path never goes through the callback (name and city were not saved there either), so `/finish-profile` collects the role.
2. **`/finish-profile`** (`src/pages/FinishProfile.tsx`, AuthGuard inside the lazy chunk). Asks only for the missing fields among first name, city (`CityPicker`), dance role (`DanceRolePicker`) and photo (`AvatarUpload` &rarr; `uploadToR2`). Saves through `saveMyDancerProfile`. "Skip for now" lasts the session. Shown once after sign-in: `/auth/callback` arms a session flag, and `ProfileCompletionChrome` hops there after a fresh check.
3. **Banner** (`ProfileCompletionChrome`, lazy, signed-in only, mounted in `AppChrome`). Shows on every page while the profile is incomplete. Its close button hides it for one page view. It never shows once `profile_complete_v1` is true.
4. **Rating gate** (`LevelRatingPrompt`, both card and compact). While the profile is incomplete the tiles are disabled, with the reason "Finish your profile to rate" and a link to the screen. With no profile row, the WhatsApp contact shows instead. A vote stashed before sign-in is held until the profile is finished. **UI only**: `rate_series_level_p5_v1` does not check completeness.
5. **`/auth` invite-only message** now shows the same WhatsApp link (`WHATSAPP_GET_LISTED_URL`) that the AuthStepper toast uses.

One shared fact: `lib/profileCompletion.ts` (`needsFinishing`, `bannerModel`, `ratingGate`, `finishScreenMode`). The hook `useProfileCompletion` resolves `_my_dancer_profile_id_v1` and then calls `profile_complete_v1(<that id>)`; it never uses auth.uid(). The rating card gets the gate through `ProfileGateContext` (in `hooks/useAuth.tsx`), so `/event/:id` gains **no** first-load chunk.

## Open

- **Server enforcement** of completeness on `rate_series_level_p5_v1` is an admin-repo migration (follow-up).
- **Review round 2 not run.** The context gate stopped the session. The round-1 fixes (10 findings: 7 fixed, 1 fixed narrower, 1 fixed with a drift test, 1 kept with a reason) are unreviewed code.
- **Not browser-walked:** the rating card itself (`/event/:id` is SSR and needs a live backend), and a real photo upload to R2.
- Pre-existing, not touched: AuthStepper loops forever when given `userType` (`setRole` is not memoised).

## Next

1. Run `/code-review` round 2 on the PR diff, then fix the findings on the same branch.
2. Phone test by Ricky with a real invited account.
3. Next slice: move every "my profile" read listed in the PR body onto `_my_dancer_profile_id_v1`.

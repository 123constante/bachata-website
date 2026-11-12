# Handover: dancer dashboard build, continuation 5 (admin 1534): critique fix round on PR #1577

Branch `claude/profile-dash-dancer-build`. No DB change, no `supabase/**`. Bundle ratchets untouched (no new imports or chunks).

## Done (brief items)
1. **Walk evidence.** `d4-claim.png` recaptured (waits for the card; looked at it, not blank). New: `d4-claim-{no_match,email_unproven,unavailable,linked}.png`, `edit-untouched-save.png` (Save + reason line in viewport), plus `welcome-no-name`, `home-linked-line`, `switch-many-confirm`. Spec assertions back each PNG. The "one profile" walk test used a stale testid (`profile-switcher-button`); now `profile-account-button`.
2. **Not me** (`ClaimYourPage`): shown only before the first result. After a result: Message us, plus Try again where `retry` is true.
3. **Dead end after linked.** `onLinked` now resolves true only when the refetch found the profile. Otherwise: "Almost there" + Reload button + Message us (no success copy). Found while testing: the claim refetch flips the query to loading, and `HomeScreen` unmounted the claim card, wiping its state. `HomeScreen` now keeps the claim card mounted through that refetch.
4. **ProfileSwitcher sheet** `max-h-[calc(100dvh-16px)] overflow-y-auto`. Vitest class check, plus a 390x844 walk (2 organisers + sign-out confirm) asserting Close in viewport and the sheet inside 0..844.
5. **No name**: h1 "Welcome", greeting line dropped (display_name still used when first_name is empty).
6. **linked-notice** folded into the main card as one plain line, no buttons. It shows once (flag written on first show), then stays gone. The old Got it / Check my profile buttons are removed.
Nit: stray doc comment above `SHOWING_LABEL` moved onto `stripLabel`.

## Verified
- Vitest: `src/modules/dancer-app`, `src/components/account`, `tests/client/dancerAppHomeNights.test.tsx`: 61 files, 1218 tests pass (re-ran home dirs + HomeNights after the last HomeScreen edit: 93 pass).
- Playwright `profile-dash-walk.spec.ts` (chromium, 390x844): 16 passed (D4 group re-run after the last edit: 6 passed). PNGs viewed: d4-claim, d4-claim-linked, home-linked-line, switch-many-confirm.
- eslint on touched dirs: 0 errors. `check:mojibake`: clean.
- tsc run on 3576185: 0 errors in branch files. Remaining errors are in files this branch does not touch (signOutStorageRace.test.tsx, Venues.tsx, venuePublicService.ts).

## Not verified
- Red-first runs against the unfixed code were not done.
- `npm run build` + `check:bundle-budget` not re-run (no new imports).
- Full `pre-ship`, remote CI, real-phone QA. PR body is for the orchestrator (no gh).
- Linked-note "shows once" is verified with a fake profile only (`linked_from_admin` true); no prod-shape survey this round (no data shape changed).

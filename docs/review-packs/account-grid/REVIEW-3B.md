# Review: Website slice 3b (landing, invite card, re-entry, `/app/welcome`, `accountGate.ts`)

Reviewed head **9eedb90** (`claude/account-grid-3b`) against base **c30e9d3** (`git diff c30e9d3 9eedb90`).
Read-only review; no code changed. Review branch: `claude/account-grid-3b-review`.

**VERDICT: CLEAN (0 blocking), 3 should, 6 notes.**

The worker's claim holds: the invite card, Continue-as list, `/app/welcome` resume (`stageFor`), the end card and
`replace` endings were already on the base (built in earlier slices under `src/modules/admin-organisers/**` and
`src/modules/dancer-app/**`). The slice adds `accountGate.ts` and makes `signInLanding` put deleted logins first. Both are
correct. The gaps are in the tests (two mutations survive) and in one owner decision (D4) that this PR's file rules
leave it unable to meet.

---

## Should

### S1. The one wiring this slice adds (`useProfileSides` -> `deletion`) has no test; a mutation that removes it stays green
`src/components/account/profiles/useProfileSides.ts:72`. **Mutation run:** I replaced the line with `deletion: null,` and ran
`accountGate.test.tsx` + `profiles.test.tsx`: 47/47 still pass. The matrix test builds `SidesFacts` by hand and calls
`signInLanding`, and `profiles.test.tsx` mocks `useProfileSides` completely. So nothing checks that `/account/continue`
actually sends a deleted login to restore. That is the rule the organiser session depends on.
**Failure scenario:** a later refactor of `useProfileSides` drops the field. A deleted login whose AuthCallback deletion read
failed (that read returns null) then lands on `/account/continue`, which shows its sides and opens an area. CI stays green.
**Fix:** add one hook-level test that renders `useProfileSides` (or `ContinueAsScreen` with the real hook) with
`my_account_deletion_status_v1` returning `pending` and `expired`, and asserts the facts carry `deletion: 'restore'` /
`'deleted-card'` and that the screen navigates to `/account/restore`. Also add a row with the deletion read still pending,
asserting the screen shows `continue-as-loading`.

### S2. "`deleted` wins over every other state, loading included" (the pinned rule) is not tested; reordering it stays green
`src/lib/accountGate.ts:39-45`. **Mutation run:** I swapped the `deleted` and `loading` branches in `composeAccountGate` (so
loading wins): 33/33 still pass. Every matrix row waits until `status !== 'loading'` before asserting, so no row ever sees
a gate where the deletion has answered and the completion has not.
**Failure scenario:** with that reorder, a consumer that renders on `status` (the organiser session's planned use) shows
its loading state, never `deleted`, until the profile read finishes. If that read hangs or errors in a way that keeps
`loading`, the deleted person is stuck on a spinner and the restore card never shows.
**Fix:** add direct table rows for `composeAccountGate` (it is exported and pure): `{completion: loading, deletion:
'restore'} -> deleted`, `{completion: loading, deletion: 'deleted-card'} -> deleted`, `{completion: error, deletion:
'restore'} -> deleted`, `{completion: complete, deletion: 'loading'} -> loading`, `{signed_out, *} -> signed-out`.

### S3. D4 is not met for a 100% dancer, and the PR's own file rules mean it cannot be fixed here (owner call)
The brief says: "a finished dancer opening `/app/welcome` sees the end card, never the setup again". On the base, the
OnboardingScreen at `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx:64-81` (`stageFor` returns `'done'`,
then `redirectHome`) sends a 100% dancer straight on without showing the end card. Only a 70-99% dancer sees it (the M71
test and the `bookmark-app-welcome-finished` journey pin this). Nobody sees the setup again and nobody loops, so the
person is not misled. They just do not see the end card the owner described. The worker flagged this in the handover
(left #2) and did not change it, which was correct: the dancer-area isolation check fails the PR on any
`src/modules/dancer-app/**` file.
**Fix:** this needs the owner's decision, not a code change in this PR. Either (a) confirm that the current behaviour
("finished = straight on") is what D4 means, and record that in `DECISIONS.md`, or (b) schedule a dancer-app PR that shows
the end card at 100% and updates M71 and the journey.

---

## Notes

- **N1. File scope (item 6).** Files outside the brief's allowlist:
  `src/components/account/profiles/useProfileSides.ts` gains +4 lines (one import, one hook call, one fact line, one
  comment). This file belongs to the Continue-as list, which the slice owns. `src/lib/accountDeletion.ts` is a 3a/3d
  file: `ACCOUNT_RESTORE_PATH` and `restorePathFor` moved to `accountRouting.ts` and are re-exported, a 2-line net
  change. That is more than "a one-line call", but it changes no behaviour and the handover lists it.
  `src/lib/__tests__/accountReviewRound1.test.ts` S2 pin relaxed: it now allows a type-only import, and still forbids a
  value import of `accountDeletion` in `accountRouting.ts` / `ContinueAsPage.tsx`. Its intent is kept.
  `src/modules/organiser/**` and `src/modules/dancer-app/**`: **none touched** (verified with `git diff --stat`).
  AuthCallback, Auth, AccountRestore and AccountSettings: untouched.
- **N2. Extra RPC per shell mount.** `ProfileSwitcher` (lazy, in `DancerAppShell` and `OrganiserShell`) uses
  `useProfileSides`, so every `/app` and organiser page now also calls `my_account_deletion_status_v1` (staleTime 30 s,
  plus react-query's default refetch on window focus). The switcher never reads `deletion`. The handover shows budgets
  and first-load still green. If the extra call matters, give the switcher a `useProfileSides({ withDeletion: false })`
  option or set `refetchOnWindowFocus: false` on the gate query.
- **N3. `fetchAccountGate` casts to `SettledAccountGate`** (`accountGate.ts:70,75`). The cast is correct today, since
  neither input can be `'loading'` there, but the type system does not check it. A runtime narrow (throw if `'loading'`)
  would make the "minus 'loading'" promise checked rather than asserted.
- **N4. For an admin with no dancer profile, the gate reports `incomplete`.** `signInLanding` still sends that admin to
  `/` (D2 unchanged, tested). But a future consumer that routes on `gate.status === 'incomplete'` to setup would change
  admin routing. Tell the organiser session: route admins via `SidesFacts.isAdmin`, never via the gate's status.
- **N5. Second chance only without a returnTo.** If AuthCallback's deletion read fails (it returns null, by design) *and*
  there is a returnTo, the person goes straight to that page and nothing re-checks the deletion. Without a returnTo,
  `/account/continue` re-checks through the gate, which is good. A deleted-card person who taps the header to go to `/app` or
  `/account/o` directly is also not gated. The area gates belong to the dancer-app / organiser slices (the organiser
  session imports `useAccountGate` for this). Not verified in a browser.
- **N6. Matrix test shape.** It is table-driven (11 rows x 3 tests + 2 edge tests). The hook == fetch assertion runs both
  against the same mocked RPCs, so it proves one mapping, not prod behaviour. Rows not present: "organisers 2+ with no
  dancer" and "organiser-intent with an unfinished dancer" (both follow from `profileSides` logic and are trivially
  right; worth a row each for completeness).

---

## Checked and fine

### 1. Landing matrix (traced in code: `AuthCallback.tsx` -> `/account/continue` -> `signInLanding(useProfileSides facts)`)
| Shape | No returnTo | With returnTo `/event/abc` | Test |
|---|---|---|---|
| signed out | `/account/continue` is behind `AuthGuard` -> sign-in; gate `signed-out` | (not a landing) | U row 1 (gate only) |
| deleted < 30 d | AuthCallback -> `/account/restore` (auto-restore) -> Continue -> `/account/continue` -> normal landing | AuthCallback -> `/account/restore?returnTo=...` -> Continue -> `/event/abc` | U rows 2 |
| deleted > 30 d | `/account/restore` deleted card (mailto actions only, no Continue) | same, returnTo kept | U row 3 |
| empty | `/app/welcome` | `/event/abc` (dancer gate then sends gated targets via `/finish-profile`) | U row 4 |
| dancer incomplete | `/app/welcome` (resumes at first missing step) | `/event/abc` | U row 5 |
| dancer complete | `/app/home` | `/event/abc` | U row 6 |
| organiser 1 (no dancer) | `/account/o` | `/event/abc` | U row 7 |
| organiser 1 + dancer | Continue as [organiser, dancer] | `/event/abc` | U row 8 |
| organisers 2+ (+ dancer) | Continue as [org-a, org-b, dancer] | `/event/abc` | U row 9 |
| organiser-intent, finished dancer | `/account/o` (claim screen) when 0 open requests; waits while the count is loading | `/event/abc` | U row 10 |
| admin, no side | `/` (as before, D2) | `/event/abc` | U row 11 |
| any shape, deletion read pending | `continue-as-loading` ("Signing you in&hellip;") | same | U edge test |
| any shape, deletion read failed | treated as not deleted (never strands) | same | U edge test |

Deleted always resolves before any side or returnTo in `signInLanding` (`accountRouting.ts:346-348`). Admin routing is
byte-identical below those three new lines.

### 2. `accountGate.ts` vs the pinned shape
- `useAccountGate(): { status: 'loading'|'signed-out'|'deleted'|'incomplete'|'complete', dancerProfileId: string|null,
  deletion: 'restore'|'deleted-card'|null }`: matches exactly (`DeletionLanding` = `"restore" | "deleted-card" | null`).
- `fetchAccountGate(): Promise<same minus 'loading'>`: matches (`SettledAccountGate`).
- One mapping: both call `composeAccountGate`. Failure handling is the same in both: a failed deletion read gives null,
  and a failed completion read gives `error`, which maps to `incomplete`.
- No new RPC: it reuses `my_account_deletion_status_v1` via `fetchDeletionStatus`, plus `useProfileCompletion` /
  `fetchProfileCompletion`.
- No duplicate of the AuthCallback check: AuthCallback is untouched, and the gate reuses `deletionLanding`.
- Query key `[DELETION_STATUS_KEY, userId]` is identical to `/account/restore`'s, and both store the same
  `DeletionStatus | null` shape, so there is no cache collision. After a restore, `invalidateQueries()` waits for the
  restore page's active query to refetch, so `/account/continue` reads the fresh not-deleted status. **No restore <->
  continue loop** (traced).
- `signedIn` uses the same definition in the gate and in `useProfileCompletion` (`id && !is_anonymous`), so an anonymous
  user cannot leave the gate stuck on `loading`.

### 3. O3 team invite (`src/modules/admin-organisers/InviteRedeemPage.tsx`, base, unchanged)
Bearer join only after pressing "Join the team" (M57). Signed in: "You are joining as <name>" plus "Not you? Sign out"
(the shared sign-out, then sign-in with the invite as returnTo; a failed sign-out stays on the page with an alert).
Signed out: a "Sign in" card that comes back to the invite. A deleted login following the invite goes through AuthCallback
-> restore first -> Continue -> the invite.

### 4. D3/D4 and guard pairs
Every onboarding end uses `navigate(end, { replace: true })` (`leaveFor`). `stageFor` resumes at the first missing
required stage. Guard pairs checked: `/app` gate -> `/finish-profile` -> `/app/welcome` -> (complete) `/app/home`: no
loop. `/account/continue` <-> `/account/restore`: no loop (above). Deleted card: there is no Continue, so nothing
bounces. 100% end card: see S3.

### 5. Empty states and controls
The Continue-as wait state names what is happening. The deleted card names the two actions and the address. The restore
failure has "Try again". No copy points at a missing control. Nothing new in this slice renders copy.

### 6. Snapshot
I put the base snapshot back and ran `auth.today` on the head code: the 4 link-sent snapshots fail. With the new snapshot,
40/40 pass. Every changed line is an addition: an empty `alert` live region (4x), plus on the two sign-up states
"By continuing you agree to the Terms and Privacy Policy" and its two links (the serializer prints the text without the
link words). That is exactly 3c's clickwrap + live region. Nothing else changed.

### 7. Tests
On base, `accountGate.test.tsx` fails (the import cannot resolve). The deleted rows would also fail against the old
`signInLanding` (it returned the returnTo or the sides). The matrix is table-driven, and the landing tests assert real
function output, not mocks. Gaps: S1, S2, N6.

## Commands run (this review)
| Command | Exit | Result |
|---|---|---|
| `npx vitest run accountGate.test.tsx profiles.test.tsx accountReviewRound1.test.ts auth.today.test.tsx` | 0 | 94/94 |
| mutation: `useProfileSides` `deletion: null` | 0 | 47/47 still pass (S1) |
| mutation: `composeAccountGate` loading before deleted | 0 | 33/33 still pass (S2) |
| base snapshot + head code, `CI=1 vitest run auth.today` | 1 | 4 link-sent snapshots fail (as expected) |

All mutations were reverted (`git checkout`); the review branch carries only this file.

## Verified / Not verified
**Verified:** the diff read in full; the landing matrix traced in code; the pinned shape compared to the brief text; the
shared query key and the no-loop restore path traced; the snapshot diff is exactly 3c's; the targeted tests are green; two
surviving mutations (S1, S2); no organiser or dancer-app file touched.
**Not verified:** full vitest, typecheck, build and Playwright were not re-run (I rely on the worker's table for those);
no browser walk; no GitHub Actions; no Vercel preview; no Supabase queries (no prod-shape survey: the slice adds no screen
over prod data); a deleted account's direct-URL entry to `/app` or `/account/o` (N5).

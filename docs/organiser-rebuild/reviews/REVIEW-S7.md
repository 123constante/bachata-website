# REVIEW-S7 -- independent review of slice S7 (My page, More, Help, the event-cover fix)

Reviewer branch `claude/org-r1-review-S7`, cut from `claude/org-r1-pagemore` head `c6ccb33`. Brief `briefs/S7-pagemore.md`, handover `handovers/S7.md`, method from `briefs/R-S5.md`. This file is the only change; no source was touched (every mutant below was reverted, `git status` clean after each run).

Stopping rule (stated before the round): ONE pass, correctness first; findings go back to S7 in one fix pass; the reviewer does not fix.

## Verdict: 0 BLOCKING / 7 SHOULD / 9 NOTE

No data-loss path found. The S7 test matrix kills 21 of 29 mutants. The 8 that survive are listed under each finding.

---

## SHOULD

**SH-1. A save that changes both a page field and a contact field goes to Done twice.** `page/useOwnPage.tsx:43` + `:82`. The layer's one Save writes two watched cache keys back to back (`EditInPlaceLayer.tsx:289` entity row, `:307` contact settings). Each write that changes the cached value fires `onSaved`, and each `onSaved` schedules its own `setTimeout(goDone)`. `goDone` pushes rather than replaces, so the history ends up `/page -> /done -> /done`, and Back from Done shows Done again. Fix: guard `onSaved` with a ref so it fires once per mount (or debounce to one tick). Mutation **M23** (`goDone` scheduled twice) SURVIVES: the unit suite (18 passed) and the e2e spec never count navigations, and no test saves a field and a contact together.

**SH-2. A save that comes back different still lands on Done "Saved". The layer's warning is lost and the leave prompt fires.** (PLAUSIBLE, traced, not run.) When `outcome.unmatched` is non-empty, the layer writes the cache (so `onSaved` fires), keeps the unmatched drafts and shows "Saved at .., but X came back different .. tap Save again" (`EditInPlaceLayer.tsx:317-330`). Because drafts remain, the deferred `goDone` meets the layer's LeaveGuard. The person sees an unsaved-changes dialog right after tapping Save, and the warning that would explain it disappears with the screen. Fix: do not navigate when the layer's notice is an error. The bridge or the notice tone has to say which case it is, or Done fires only once no drafts are left.

**SH-3. A contact-only save can skip Done after a quick return to /page or /more.** (PLAUSIBLE, traced.) `useSavedSignal` treats the first value it sees for a key as a load (`useOwnPage.tsx:42`). The contact query has `staleTime: 60s` (`EditInPlaceLayer.tsx:111`). If /more or /page mounts again within 60 s, the query does not refetch and no event arrives. The first real event is then the save's own `setQueryData`, which gets swallowed as a "load". The person stays on the screen with only the layer's "Saved at" line (no data loss, but D29 is inconsistent). Fix: seed `seen` from `queryClient.getQueryData(key)` when subscribing.

**SH-4. An owner who has a co-owner is told "Hand over first", but the server would let them leave.** `more/index.tsx:49,82,90`. Prod fact: `remove_organiser_member_v1` refuses an owner only when they are the last one (`v_owner_count <= 1 -> last_owner`). A manager may always remove themself, and there is no last-manager rule. Prod shapes (counts only): of the 3 member-owned pages, 2 have exactly 1 owner and 0 managers, and **1 has 2 owners and 0 managers**. For that page both owners see Leave disabled with a reason pointing at Hand over, a step the other owner does not need. This follows the brief's literal wording ("for an OWNER disabled"), but 4.8 calls it "the sole-owner refusal". **Owner decision:** keep the literal rule, or disable only the SOLE owner (the owner count is already in the layer's team read, `organiserTeamQueryKey`). Zero managers exist on prod, so the manager Leave path has never met prod data.

**SH-5. The cover fix reuses its idempotency key even when the person picks a different photo, and the reuse is untested.** `flows/fix/CoverFlow.tsx:36`. The server replays any stored response for `(actor, key)` without comparing the payload (`apply_aggregate_write_p5`: `IF FOUND THEN RETURN v_existing.response_payload || idempotent_replay`). Failure path: the first upsert commits but its response is lost (network). The screen shows the error, the person picks a DIFFERENT photo, the replay returns success and Done says "Cover added", but the stored cover is the first photo. Fix: key per uploaded url (reset `key.current` when the url changes). Mutation **M17** (a new key on every try) SURVIVES (3 passed), and **M18** (version taken from the cached workspace instead of a fresh read) SURVIVES (3 passed). Neither idempotency reuse nor the fresh-version read is asserted (the same defect class R-S5 names).

**SH-6. Pinned item "Add a page for every login" has a test gap.** The code is right: the row is not gated on `selected` (`more/index.tsx:73`). But mutation **M13** (`{selected && <LinkRow .. Add a page>}`) SURVIVES (8 passed). The matrix covers owner and manager but not a login whose page did not load or that has no `selected`. Fix: add a no-selected row to the table.

**SH-7. Two table rows cannot fail.** (a) Help: the test compares each href to `HELP_ROWS[i].to` from the same table (`More.test.tsx:146`), so a wrong destination passes. Mutation **M14** (Change a date -> `/add`) SURVIVES. Pin the expected paths literally. (b) The cover Done button text: mutation **M20** (drop `nextLabel: 'Back to the event'`, so the button reads "Put it back") SURVIVES. Assert `nextLabel` or the rendered text.

## NOTE

- **N-1 (a) z-index injection.** No cleaner fix exists inside S7's own files. The dock sets `zIndex: 50` as an INLINE style (`EditInPlaceLayer.tsx:424`), and only `!important` beats an inline style. The real fixes are `BAR_Z` (`edit-in-place/layers.tsx:28`, protected) or the shell's `z-[60]` (`shell/OrganiserShell.tsx:84`, S1). **Leak:** none past the screen. The `<style>` lives inside the layer's `Suspense` (`useOwnPage.tsx:90`), so it mounts and unmounts with /page and /more. **Sheets:** they still work. Each sheet is its own `inBody` portal appended on open, so its overlay (60) comes after the dock (60) in the DOM and covers it. The sheet (61), the layer's leave dialog (70/71) and the organiser `SheetView` (70/71) all stay above. The unit tests cannot catch a regression here: mutation **M25** (rule removed) SURVIVES the unit tests (26 passed) but is KILLED by `tests/e2e/organiser-profile.spec.ts:11`, which is in the `test:e2e` gate.
- **N-2 (b) Done deferred one tick.** No unsaved-changes bypass: the navigation still goes through the layer's LeaveGuard, so leftover drafts block it (see SH-2) rather than being dropped. The double-navigate race is SH-1. Mutation **M24** (no deferral) SURVIVES the unit tests (MemoryRouter has no blocker) and is KILLED by e2e `organiser-profile.spec.ts:11`. The timeout is never cleared on unmount (harmless at 0 ms).
- **N-3 (c) `profile/` leftovers are all still needed, none dead.** `profile/profileForm.ts` re-exports `page/profileForm` for `edit-in-place/EditInPlaceLayer.tsx:25`, `draftModel.ts:25` and `bridge.ts:8`. These import the VALUE `formFromEntity`, not only the type the handover names. `profile/OrganiserSwitcher.tsx` is imported by `team/index.tsx:43`. `profile/useOrganiserChoice.ts` is imported by `team/index.tsx:44` and `flows/new/NewFlow.tsx:12`. Separately, the brief asked for `git mv`, but git sees `page/*` as Added and `profile/index.tsx` as Deleted (`git diff -M50% --name-status`), so `git log --follow` loses the history.
- **N-4 (d) Merge-conflict risk with S6 (`claude/org-r1-team` 18cccba).** A trial `git merge --no-commit` of S6 into S7 conflicts in exactly 3 files. `flows/doneState.ts`: comment only (S7 "Cancel's put-back" vs S6 "Team's removal says Add them back"), and the code lines are identical. `shell/OrganiserRoutes.tsx`: each slice swaps its own placeholders, so take both. `shell/__tests__/routes.test.tsx`: each slice removes its own placeholder rows. `flows/Done.tsx` is the same edit on both sides and merges clean. `tests/e2e/helpers/organiserFake.ts` is touched by both and merges clean. Not fixed, as instructed.
- **N-5 (e) /privacy and /terms.** Both routes exist in `src/components/AnimatedRoutes.tsx:214-215` (`<Privacy/>`, `<Terms/>`), and so does `/account/settings` (`:211`). Hrefs are asserted (M15 KILLED). They were NOT rendered in a browser by this review either.
- **N-6 (g) Empty states.** All say what the person can do. "This page is not available .. Pick another page from Home" (`page/index.tsx`) points at a switch that Home shows only with 2+ pages. Naming: More says "Add a page" but the screen it opens is titled "Add an organiser" (`home/index.tsx` ~line 116).
- **N-7 (h) Tap targets.** More rows 52px, Help rows 52px, Team link 52px, cover picker 56px, all in px (M28 KILLED). Edit-layer controls are S0a's.
- **N-8 (i) Cover fix shapes (prod counts).** Member-owned series: 5 drafts (recurring), of which 4-5 have no cover and will show the `no_cover` row; 1 live and 1 ended recurring, both with covers. A series that already has a cover is reachable from Details/C23: it shows "Current cover" and "Choose a different photo", and the upsert replaces it. Fine. Festivals are NOT excluded from `no_cover` (`jobs/homeJobs.ts:42`). Prod has 0 member-owned festivals and 2 archived festivals without a cover, and it was not checked that the public festival page reads `default_cover_image_url`. Error copy: a non-RPC error shows the raw `err.message` (e.g. "Failed to fetch") (`CoverFlow.tsx:43`). Back always goes to Home, even when the person came from Details.
- **N-9 (j) Page rows on prod shapes (counts only).** Member-owned pages: 3, all `live`, so no draft page exists on prod. Missing about: 3 of 3, rendered through the layer's `about-empty` slot, which reads "Not added yet. Optional: tell dancers who you are..". No photo: 1 of 3, shown as initials. No city: 0. Unowned live pages: 43 (not reachable here). A new TS error appears: `more/__tests__/More.test.tsx(143,33) TS2345` ('/account/o/more/help' not assignable to '/account/o/more'). It does not gate (typecheck.yml is message-scoped), but the handover's "no error in src/modules/organiser except TeamPicker" is inaccurate.

## Mutation table (each applied alone, the named suites run, then reverted)

| # | Mutant | Result |
|---|---|---|
| M1 | owner Leave click opens confirm | KILLED |
| M2 | owner reason text hidden | KILLED |
| M3 | owner Leave not aria-disabled | KILLED |
| M4 | Hand over for every role | KILLED |
| M5 | Hand over hidden for owner | KILLED |
| M6 | manager Leave sends two removes | KILLED |
| M7 | manager Leave skips the confirm sheet | KILLED |
| M8 | Leave does not land on Done | KILLED |
| M9 | WhatsApp row shown with env unset | KILLED |
| M10 | email href without `mailto:` | KILLED |
| M11 | Add a page owner-only | KILLED |
| M12 | Add a page without `?add=1` | KILLED |
| M13 | Add a page hidden with no `selected` | **SURVIVED** (SH-6) |
| M14 | Help row points at the wrong flow | **SURVIVED** (SH-7a) |
| M15 | Privacy href wrong | KILLED |
| M16 | cover sends two commands | KILLED |
| M17 | cover new idempotency key each try | **SURVIVED** (SH-5) |
| M18 | cover version from cache, not fresh | **SURVIVED** (SH-5) |
| M19 | cover Done without `next` | KILLED |
| M20 | cover Done `nextLabel` dropped | **SURVIVED** (SH-7b) |
| M21 | cover sends after a refused upload | KILLED |
| M22 | Done fires on first load | KILLED |
| M23 | Done fires twice | **SURVIVED** (SH-1) |
| M24 | Done not deferred | SURVIVED unit / KILLED e2e (N-2) |
| M25 | dock z-index rule removed | SURVIVED unit / KILLED e2e (N-1) |
| M26 | Live chip always | KILLED |
| M27 | put-back draft not cleared (untouched -> Save bar) | KILLED |
| M28 | More row 40px | KILLED |
| M29 | owner treated as manager (owner Leave works) | KILLED |

Untouched sheet sends nothing: `Page.test.tsx:89,111` assert that no Save bar shows and zero `organiser_profile_update_p5_v1` calls are made (M27 KILLED).

## CI table (sandbox, on c6ccb33)

| Step | Command | Result |
|---|---|---|
| unit (slice) | `npx vitest run more page flows/fix shell draftOrganiser.matrix` | 10 files / 123 tests pass |
| unit (all) | `npm run test:unit` | 352/356 files, 15 tests red in 4 files (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` live-DB contracts; `integrityCouldNotRun` exec bit): the same 4 the handover lists, all environmental |
| e2e | `npx playwright test tests/e2e/organiser-profile.spec.ts --project=chromium` | 3 pass warm. The FIRST cold run had 2 red (Save spec and draft spec) and passed on re-run unchanged: likely a cold dev-server timeout, worth watching in CI |
| typecheck | `npx tsc --noEmit -p tsconfig.app.json` | 97 errors; the only new one in the slice is `More.test.tsx:143` (N-9). Base count not comparable in a scratch worktree (react-router typegen missing there) |
| build | `npm run build` | exit 0 |
| lint chain | `npm run lint` | every link PASS except `check:integrity` exit 126 (sandbox exec bit, same as handover) |
| mojibake | `npm run check:mojibake` | exit 0 |
| architecture | `npm run lint:architecture` | exit 0 |
| images | `AUDIT_STRICT=1 npm run check:images` | exit 0 |

Could not run: GitHub PR checks (no `gh`), Vercel preview.

## Verified / Not verified

**Verified:** the brief and handover were read. The diff was read against the S7 row. 29 mutants were run against the suite (table). Mutants M24/M25 were run against the e2e spec. A trial merge with S6 was done. Prod (SELECT only, counts only): `remove_organiser_member_v1` rules, the owner/manager counts per page, page null shapes and series cover shapes. Routes for /privacy, /terms and /account/settings were checked in the route table. All CI steps above were run.

**Not verified:** SH-2 and SH-3 are traced from code, not reproduced in a running browser. /privacy and /terms were not rendered. There was no phone walk at 390x844. No PR-check status was read. The public festival page's use of `default_cover_image_url` was not checked.

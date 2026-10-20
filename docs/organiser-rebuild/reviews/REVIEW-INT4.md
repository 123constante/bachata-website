# REVIEW-INT4 -- independent review of the INT4 delta (PR #809, head fa609c67)

Reviewer: a different worker from the INT4 author, one pass, brief `R-INT4.md` (sha aef0c527).
Scope: commits 4410d037, 3a0da8fa, fa609c67 only. Admin contract read from `bachata-admin`
`claude/org-r1-parity-aw1` @ 0abbf14 (migrations `20261126220000`, `20261126230000`).
Prod shapes: read-only SELECT counts on `stsdtacfauprzrdebmzg`, no personal data.

## Verdict: 0 BLOCKING / 3 SHOULD / 6 NOTE

Every mutant the brief asks for goes red, except one NOTE-level one (the title clamp, which the server
already does). The three SHOULDs are copy that is wrong for real prod shapes once AW1_APPLIED turns on;
they are dark in prod today. The live shell fix (fa609c67) is safe in shape, but the e2e numbers do not
match the handover's claim: see E2E below.

## Findings

### S-1 (SHOULD) An empty session title gets the generic refusal, not the session-remove copy
`src/modules/organiser/shared/selfServeErrors.ts:170` matches `removing the session "(.{1,200})"`.
The server sends `left(i.title, 80)`; prod has **239 of 662** programme items with title `''`, and
**5 items in 3 series** with an empty title HAVE per-date overrides (the exact case this refusal fires on).
For them the server text is `removing the session "" would delete ...`, the regex needs one character,
so the owner sees "You cannot make that change here. Ask the Bachata Calendar team." (probe output,
below), which hides the reason and the way out.
**Fix:** match `"(.{0,200})"` and, when the captured title is blank, say "One of the sessions has changes
on some dates, so only an admin can remove it..." (add both rows to the AW1 table test).

### S-2 (SHOULD) The remove sentence points at "those dates", which the confirm does not show and which the server counts differently
`src/modules/organiser/events/programmeSeriesModel.ts:267` (`CHANGED_SESSION_REMOVE`), used by
`removeConfirmCopy` (`:270`, shown at `ProgrammeSeries.tsx:64`) and the Differs card (`ProgrammeSeries.tsx:138`).
- In the confirm there is no list of dates, so "one of those dates" refers to nothing on screen, and it is
  shown on every series, including one where no session has a per-date change (true but irrelevant there).
- The Differs card lists only UPCOMING, non-cancelled dates (`differingDates`, `programmeSeriesModel.ts:176`),
  but the server refuses for ANY override row (`event_occurrence_session_override_p5`, past or cancelled
  included). Prod: of the **57** items with overrides, **46** have them ONLY on past or cancelled dates. For
  those series the card is hidden, the confirm talks about "those dates", the owner saves, and the save is
  refused. The copy does not claim something false, but it does not tell the owner the remove will fail.
**Fix:** in the confirm say "If this session was changed on any date, past ones included, only the Bachata
Calendar team can remove it." (no "those"), and keep the "those dates" wording only on the Differs card.

### S-3 (SHOULD) The session title is user text inside the server message, and earlier unanchored rules see it first
`selfServeErrors.ts:170` sits AFTER unanchored rules such as `:130` `/on a past date is admin-only|^past_date/`,
`/shift would collide/`, `/cancellation_reasons label/`, `/description is longer than/`, `/default_duration_minutes/`.
A session called e.g. `Bachata on a past date is admin-only` gets "This date has already happened, so it can
no longer be changed." (probe output). No prod title does this today, but the title is free text.
**Fix:** move the three INT4 rules (anchored, `^permission_denied: removing the session` first) to the top
of `COMMAND_COPY`, and add one shadowing row to the AW1 table test.

### N-1 (NOTE) The 80-character clamp is untested
Mutant M4 (`hit[1].trim().slice(0, 80)` -> `hit[1]`) stays green. Harmless: the server already sends
`left(title, 80)` (prod: 9 titles over 80). Fix: a row with a 120-character title asserting the 80 cut,
or drop the slice and say the server clamps.

### N-2 (NOTE) The picker does not check `is_active`; the server does
Server (`20261126230000`, line 787-789) needs `lifecycle_status = 'live' AND COALESCE(is_active, true)`;
`addablePages` (`organisersModel.ts:28`) checks only `lifecycle_status`, and `organiser_home_v1` does not
read `is_active` (prod function source). Prod: all 8 owner/manager pages are `live` with `is_active` null
or true, so 0 rows today. If one is ever deactivated, the UI offers it and the save gets the generic
`permission_denied` line, since `can only add a live organiser page` has no mapping either.

### N-3 (NOTE) A page the owner removed in this edit cannot be put back unless it is theirs
`addablePages(myPages, ids)` offers only the viewer's pages, but the server allows any page that is already
stored on the series (`NOT (e.id = ANY (v_series_orgs))`). Prod: 6 series have 2 organisers. An owner who
removes the co-organiser by mistake must leave without saving; the UI hides a page the server would allow.
The only UI/server disagreement found in item 3.

### N-4 (NOTE) `ADD_NONE_LEFT` claims "Every live organiser page you run is already linked" when they run none live
A series owner whose page is draft or pending gets this sentence (true for an empty set, misleading).
Prod: 0 such users (all owner/manager pages are live). No fix needed now.

### N-5 (NOTE) The stale-id copy also covers two client bugs
`a programme id appears more than once` / `must be blank or a uuid` get "This programme changed since you
opened it. Reload the page..." Reload does fix both (it rebuilds the tree from the server), so acceptable.

### N-6 (NOTE) Shell spacer
`OrganiserRoutes.tsx:45` draws `aria-hidden` 44x44, identical to the switcher's own Suspense fallback
(`OrganiserShell.tsx:51`), so no layout shift is introduced where the real switcher renders. Where
`ProfileSwitcher` renders nothing (it can), the spacer then disappears: a 44px change of the title width
only (the title is `flex-1 truncate`, no vertical shift). No live flow taps the button inside the
loading frame (it was thrown away mid-tap: that was the bug). A11y: the loading frame now announces no
Switch-profile control; the skeleton keeps its "Loading" label. Screenshots: not taken (see Not verified).

## Item 2: refusal regexes vs the exact server strings
Copied from the migrations (distinct `RAISE` texts), not the handover:
- `permission_denied: removing the session "%" would delete its per-date changes; ask an admin to remove it` (`left(v_req_key, 80)`, `v_req_key = i.title`)
- `invalid_payload: this programme save carries no ids but the series has per-date changes; reload the editor and save again`
- `invalid_payload: a programme id must be blank or a uuid` / `appears more than once` / `does not belong to this series`
- `permission_denied: series.set_organisers can only add an organiser page you own or manage; ask an admin to add another page`

All match, and the existing AW1 table test pins them. Probe (scratch test, not committed): none of 15 other
AW1 refusals (`command.kind required`, `organiser_ids must be uuid strings`, `organiser_not_found`,
`program tree requires`, `set_organisers requires organiser_ids`, `unknown command kind`, bare `permission_denied`,
`can only add a live organiser page`, `is admin-only`, `must keep an organiser you own`, `needs an admin or an
owner`, `names a person who cannot be added`, `festival programmes are admin-only`, `target not found or not owned`,
`on an ended series is admin-only`) matches a new pattern: 15/15 pass. Probe output:

```
"" (empty title)                         -> You cannot make that change here. Ask the Bachata Calendar team.   (S-1)
"Bachata on a past date is admin-only"   -> This date has already happened, so it can no longer be changed.   (S-3)
'Class <b>x</b> "quoted"'                -> The session "Class <b>x</b> "quoted"" has changes ...  (plain text; StepError renders a React text node, no HTML)
"Newline\nTitle"                         -> generic line (prod: 0 titles with a newline)
```
Raw server text is never shown: the only server substring that reaches the screen is the title capture.

## Mutation table
Harness: apply one mutant, run the named vitest files, restore (tree clean after, `git status` checked).

| # | Mutant | Tests | Result |
|---|---|---|---|
| M1 | session-remove regex `would delete` -> `would remove` | selfServe.test.ts | RED 1 failed / 36 |
| M2 | stale-id regex drops `a programme id ` | selfServe.test.ts | RED 3 failed / 36 |
| M3 | set_organisers regex `own or manage` -> `own and manage` | selfServe.test.ts | RED 1 failed / 36 |
| M4 | title clamp removed | selfServe.test.ts | **GREEN** (N-1) |
| M5 | item id dropped from the set_program payload | int4.aw1.contract | RED 1 failed / 6 |
| M6 | day id dropped | int4.aw1.contract | RED 1 failed / 6 |
| M7 | `id` added on a person | int4.aw1.contract | RED 1 failed / 6 |
| M8 | profile_type derived from role | int4.aw1.contract | RED 1 failed / 6 |
| M9 | `addablePages` offers non-live pages | sw1.parity | RED 1 failed / 50 |
| M10 | `addablePages` offers already-linked pages | sw1.parity | RED 3 failed / 50 |
| M11 | remove confirm drops `CHANGED_SESSION_REMOVE` | sw1.parity + fixSw1.matrix | RED 2 failed / 103 |
| M12 | A-S1 guard: `DatesTakenOff` conflict view removed (`if (flow.conflict) return <EventConflict/>`) | consistency.render.matrix | RED 1 failed / 64 |

Item 6: no contract mutant survives (M5-M8), so nothing BLOCKING there. Item 5: the A-S1 fixture
change still fails when its production rule breaks (M12).

## Item 3: picker vs prod shapes (counts)
- Users by pages run (owner/manager): **5 run 1, 1 runs 3**; users running 0 have no home rows and no series role.
- `entity_members` organiser roles in prod: **owner 8**, no manager, no member/contributor rows. `organiser_home_v1`
  selects only `member_role IN ('owner','manager')`, so a member-only page can never reach `myPages`.
- Owner/manager pages: **live/null 6, live/true 2**; no draft, inactive or archived page today.
- Series by organiser count (non-template): 0 orgs 571, 1 org 164, 2 orgs 6.
- `searchLiveOrganisers` / `org-add-search`: 0 references left in `src`, `tests`, `scripts`; production build passes.
- Agreement with `_is_entity_member('organiser', id, uid, ARRAY['owner','manager'])` + live + is_active:
  the UI never offers a page the server refuses on today's data; it hides one shape the server allows (N-3)
  and would offer one it refuses if a page is deactivated (N-2).

## Item 4: remove copy
See S-2. The sentence never names a control (no "button", no "tap"); it names the Bachata Calendar team.

## E2E repeats (`--retries=0 --workers=1 --repeat-each=8`, dev webServer from playwright.config)
| Run | Tree | Spec | Result |
|---|---|---|---|
| 1 | branch fa609c67 | dancer-home.spec.ts:188 | **7/8** (iteration 1 red: `profile-switcher-button` not visible in 15s, still waiting for `/account/o` navigation) |
| 2 | branch fa609c67 | dancer-home.spec.ts:188 | **7/8** (iteration 1 red, same error) |
| 3 | main fddd4f4 | dancer-home.spec.ts:168 | **8/8** (the claimed pre-existing flake did not reproduce) |
| 4 | main fddd4f4 (control, before the fix) | dancer-home.spec.ts:188 | **6/8** (iteration 1 red, cold start, `dancer-home-completeness` not found in 15s; iteration 5 red, `locator.click` timeout 15s: the vanish-mid-tap flake) |

Reading: the fix does remove the warm-server flake (main 1/7 warm iterations red; branch 0/14). The handover's
"8/8" does not hold on a cold dev server: the FIRST test after the server starts is red on both trees
(2/2 branch runs, 1/1 main), a cold-compile timeout that is not this PR's. `dancer-home.spec.ts` is in the
`test:e2e` gate, so CI may see it if its first spec is this one; CI retries are configured, these runs used `--retries=0`.
The claimed pre-existing flake at `:168` did not reproduce (8/8).

## Item 7: CI steps run here
| Step | Result |
|---|---|
| `npx vitest run src/modules/organiser` | 113 files, 3534 passed, 2 skipped (included a 17-test scratch probe, since removed) |
| `npm run lint` | 19/20 links PASS; `check:integrity` exit 126 = `bin/check-integrity.sh` is mode 100644 in git (same on main), so `sh` cannot exec it here. `bash bin/check-integrity.sh`: ok, 1970 files, 0 issues. `eslint .` skipped by the chain (informational) |
| `npm run lint:architecture` | exit 0 |
| `npm run check:mojibake` | exit 0 |
| `npm run build` (production) | exit 0 |
| `npm run check:bundle-budget` | All first-load JS budgets respected |

Could not run: the DB contract workflow (needs secrets), Vercel preview (no token checked), GitHub gates on #809 (not waited for, per the brief).

## Verified
- Exact AW1 server strings vs the three new regexes, and 15 other AW1 refusals do not match them.
- Title is shown as plain text, clamped to 80 by the server; no raw server text otherwise.
- 11 of 12 mutants red; the green one is NOTE-level (N-1).
- Picker shapes against prod counts; `organiser_home_v1` and `_is_entity_member` read from prod source; no leftover importer of the removed search; build green.
- Prod counts behind S-1 (5 items / 3 series) and S-2 (46 of 57 items).
- e2e repeat numbers above.

## Not verified
- 390x844 before/after screenshots of the loading frame (N-6 reasoned from code: same 44x44 box as the switcher's own fallback).
- Whether the iteration-1 failure also happens on CI's warm runner (CI uses the same dev webServer).
- Screen-reader output on a device.
- `walk-int4.spec.ts` was not re-run (not in the gate).

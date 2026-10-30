# Scope G1: Website write-door check (design for one build slice)

Ticket `scope-g1`, brief `docs/briefs/scope-g1.md` (branch `brief/scope-g1`). Docs only, one round.
Written 2026-10-30 from the repo at `origin/main` 1dc1660 and read-only prod queries
(project `stsdtacfauprzrdebmzg`, names and counts only, no personal data, no writes).

## 0. Read this first: a seventh door is open

The live guard reports 6 doors gated and 0 violations. But the Website writes events through a
SEVENTH RPC that the guard does not list and that has no gate line:

| Fact (prod, read 2026-10-30) | Value |
|---|---|
| `admin_bulk_occurrence_command_p5` executable by `authenticated` | yes |
| its body reaches `apply_aggregate_write_p5` | yes |
| contains `_require_onboarding_complete_v1(` | **no** |
| named anywhere in `check_organiser_onboarding_gate_v1` body | **no** |
| its entry check | `IF NOT (public.is_admin() OR public._can_act_as_organiser_p5(auth.uid()))`, then `_assert_can_edit_series_p5(target, actor)` |
| Website caller | `src/modules/organiser/flows/change/bulkApi.ts:13` (`runBulkCommand`), used by `flows/change/Pick.tsx` (C58: "cancel or move several dates ... it admits the series' owner/manager") |

So any owner or manager can cancel or move several dates at once with the flag ON and onboarding
unfinished. The guard's discovery net (4.3 b) almost certainly counted it as "admin-checked" because
the body mentions `is_admin()`; the check is a substring, while the real rule is `is_admin() OR
organiser`. This is an admin-repo fix (gate line in its body, plus tighten the net so "mentions
is_admin" is not enough), and the owner must decide Q1 in section 5 before the flag goes ON.
The Website check below is designed to catch exactly this class from the Website side.

## 1. The doors and every Website call site

### 1.1 What the live guard says (prod)

`select check_organiser_onboarding_gate_v1()` (STABLE, `SECURITY DEFINER`, executable by anon and
authenticated, so the CI publishable key can call it):

```json
{ "gated": 6, "probes": 39, "flag_on": false, "healthy": true,
  "discovered": 9, "violations": [], "violation_count": 0 }
```

Flag row `app_feature_flags.flag_key = 'organiser_onboarding_gate'`: `enabled = false`.

The guard body holds two name lists (read with a regexp over `prosrc`):

- **Gated (the six):** `series_command_p5(jsonb)`, `occurrence_command_p5(jsonb)`,
  `organiser_save_event_v1(uuid,jsonb)`, `organiser_save_festival_v1(uuid,jsonb)`,
  `organiser_set_occurrence_programme_v1(uuid,integer,jsonb)`, `organiser_undo_last_change_v1(uuid)`.
  All six are definer, executable by authenticated, not by anon, and contain the gate call.
- **Allow-list (writes that are not event edits):** `series_invite_respond_v1(uuid,boolean)`,
  `series_leave_v1(uuid,uuid)`, `series_remove_organiser_v1(uuid,uuid)`, `self_heal_occurrence_integrity_v1()`.

Helpers (`_require_onboarding_complete_v1`, `_onboarding_missing_v1`, `_command_target_organisers_p5`):
definer, NOT executable by anon or authenticated. Correct.

### 1.2 Website call sites (non-test `src/`, grep of the RPC name)

| Door | Raw call (the only `supabase.rpc` for it) | Wrapper | Callers of the wrapper |
|---|---|---|---|
| `series_command_p5` | `src/modules/organiser/shared/selfServeApi.ts:282` | `runSeriesCommand` | `shared/runCommands.ts`, `shared/useOwnerCommand.ts`, `flows/new/useNewSend.ts`, `flows/new/NewFlow.tsx`, `flows/fix/CoverFlow.tsx`, `dates/useDateEditor.ts`, `p3/data/sessions.ts`, `p3/data/repeat.ts`, `p3/data/dates.ts` |
| `occurrence_command_p5` | `selfServeApi.ts:288` | `runOccurrenceCommand` | same set (via `runCommands.ts` / `useOwnerCommand.ts` / `p3/data/dates.ts`) |
| `organiser_set_occurrence_programme_v1` | `selfServeApi.ts:323`, through `programmeRpc(fn, ...)` whose `fn` is a typed union (`selfServeApi.ts:305`) | `saveOccurrenceProgramme` | `dates/useDateEditor.ts`, `p3/data/sessions.ts` |
| `organiser_save_event_v1` | **none** (only generated types: `src/integrations/supabase/types.ts:11987`, `src/types/supabase.ts:7065`) | - | - |
| `organiser_save_festival_v1` | **none** (not in the generated types either) | - | - |
| `organiser_undo_last_change_v1` | **none** (types only, `types.ts:12033`) | - | - |
| 7th, ungated: `admin_bulk_occurrence_command_p5` | `src/modules/organiser/flows/change/bulkApi.ts:13` | `runBulkCommand` | `flows/change/Pick.tsx` |

Outside `src/`: `scripts/walk-seed.mjs:222-224` calls the two command RPCs to seed walk data
(service tooling, not a user path; out of scope of the check). No direct table writes to series or
occurrence tables exist in `src/` (grep of `.from('...').insert|update|upsert|delete` on those tables: 0).

Note the indirection that a scrape must handle: about a dozen modules define
`const rpc = (fn: string, args) => (supabase as unknown as UntypedRpc).rpc(fn, args)` and pass the
RPC name as a string later (`profileProgress.ts`, `teamRpcApi.ts`, `goLiveCheck.ts`,
`ownershipApi.ts`, `p3/onboarding/*Api.ts`, `admin-organisers/*`, `areas/*`). None of them names a
door today, but this is the spelling a new door would most likely arrive in.

## 2. What "goes through the gate" means in Website code

Today: **nothing Website-side recognises the onboarding refusal.**

- `grep onboarding_incomplete src` = 0 hits.
- Every door's error lands in `commandErrorMessage` (`shared/selfServeErrors.ts:279`) or
  `programmeErrorCopy` (`:437`). Neither has an `onboarding_incomplete` row, so the user sees the
  GENERIC line, not the onboarding screens. The server raises `P0001`, message
  `onboarding_incomplete`, DETAIL `{"missing":[...],"organiser_id":"..."}`, HINT `Finish your details`
  (plan 4.3); `isServerRefusal` will classify it correctly, so it is NOT mistaken for offline.
- The pre-flight side exists in part: `organiser_onboarding_status_v1` is read by
  `p3/screens/GraceBanner.tsx:36` (banner) and `p3/onboarding/pageApi.ts:98`; plan section 7 puts the
  client gate in `home/onboarding/profileGate.ts` (`tapGate` gains an `onboarding` kind).

Proposed definition (the builder implements the first two in the same slice as the check, or the
check is written against them as targets that already exist):

1. **One write funnel.** Every door is called ONLY from an allow-listed wrapper module:
   `shared/selfServeApi.ts` (series, occurrence, programme) and `flows/change/bulkApi.ts` (bulk).
   No other file may name a door RPC in a call position.
2. **One refusal mapping.** `selfServeErrors.ts` gets an `isOnboardingRefusal(error)` predicate and
   an `ONBOARDING_REFUSAL` copy row FIRST in `COMMAND_COPY` and `PROGRAMME_COPY`
   (`/^onboarding_incomplete/`). Plain words, e.g. "Finish your details first, then you can change
   events." with a Continue that opens the onboarding flow (the screen the gate shows; plan 6:
   "`onboarding_incomplete` maps to the onboarding screen, never a raw error"). Every door's caller
   reaches this mapping because every caller already uses `commandErrorMessage` /
   `programmeErrorCopy`; the check pins that the mapping exists.
3. The client pre-flight (`tapGate` onboarding kind) is UX, not the guarantee; the server is. The
   check does not try to prove every button is pre-flighted (that is a call-graph problem with a
   poor cost/benefit; section 3).

## 3. The check's design

**Name:** `scripts/check-onboarding-write-doors.mjs`, npm `check:onboarding-write-doors` and
`check:onboarding-write-doors:self-test`.

**Algorithm: scrape, not AST, not call-graph.** Precedent is `check-legacy-program-rpcs` (a name
scrape that already gates in `architecture-guard.yml`). An AST buys little: the door names are
string literals and the risky spelling (a string passed to an untyped `rpc` helper) is a literal too.
A call graph is out of proportion (dozens of callers, React hooks, dynamic dispatch) and would still
not prove the UI routes the refusal well.

Two parts, one exit code:

**Part A, static (no network, always runs).**
1. Read the door list from a checked-in JSON, `scripts/onboarding-write-doors.json`:
   `{ "gated": [six names], "known_ungated": ["admin_bulk_occurrence_command_p5"], "wrappers": ["src/modules/organiser/shared/selfServeApi.ts","src/modules/organiser/flows/change/bulkApi.ts"] }`.
   `known_ungated` must be EMPTY once admin gates the seventh door; while it is non-empty the
   check prints a `[WARN]` naming it (not red, so the guard can land before admin's fix; see Q1).
2. Walk `src/**/*.{ts,tsx}` excluding `__tests__/`, `*.test.*`, `*.spec.*` and the two generated
   type files. Strip comments with `scripts/lib/stripSource.mjs` (comments name doors all over
   `src/`, so an unstripped scrape over-fires).
3. Any string literal (single, double or backtick quotes, no interpolation) equal to a door name,
   gated or ungated, in a file NOT in `wrappers` -> violation `door-outside-wrapper`.
4. Any string literal that looks like a write RPC (`/_command_p5$|^organiser_(save|set|undo)_|_save_.*_v\d+$|_upsert_|_set_.*_v\d+$/`)
   that is NOT in `gated`, `known_ungated`, or a small `not_event_writes` allow-list in the JSON
   (team, profile, onboarding saves) -> violation `unknown-write-rpc`. This is the "new door" net.
   Each allow-list entry carries a one-line reason, and a stale entry (name no longer in `src`) is red,
   the same ratchet shape as `script-conventions-allowlist.json`.
5. `selfServeErrors.ts` contains an anchored `onboarding_incomplete` row as the FIRST element of
   both `COMMAND_COPY` and `PROGRAMME_COPY` -> else violation `refusal-unmapped`.
6. `assertMeasured()` floor: the scrape must have read more than N files (say 200) and found every
   `gated` name that has a Website caller (today 3) in a wrapper; finding 0 is exit 2, never green.

**Part B, live (needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`).**
1. Call `check_organiser_onboarding_gate_v1()` with the publishable key.
2. Red if `healthy !== true`, `violation_count !== 0`, or `gated !== gated.length` from the JSON.
3. Red if a name in the JSON `gated` list is not in the live gated set, or vice versa (needs the
   report to list names; today it returns counts only, see section 5 Q3). Until then compare counts.
4. Missing creds, unreachable URL, RPC 404, non-JSON body: **exit 2**, never 0 (R1, R3). Part B
   runs only with `--live`, and the db-contract step passes `--live` so missing secrets there are
   exit 2; the lint chain runs Part A only.

**Exit codes:** 0 clean, 1 any violation, 2 could not run (unreadable file, empty sample, creds,
network). Part A's verdict is still printed when Part B is exit 2.

**Conventions it must satisfy (`docs/ci-guard-notes.md`, six rules):**

| Rule | How |
|---|---|
| R1 silent-skip | no green from missing creds or an empty scan; `assertMeasured()` floor in Part A; exit 2 in Part B |
| R2 swallowed-error | no empty `catch`, no `.catch(() => default)`; an unreadable file is exit 2 |
| R3 exit-drift | 0 / 1 / 2 exactly as above; missing creds = 2 |
| R4 no-canary | ships `--self-test` |
| R5 unproven-exit | copy `check-ci-budget.mjs`: `main(argv, deps)` with injected `readFiles`, `callRpc`, `env`; the canary drives `main()` and pins WHICH branch produced each code; `process.exitCode = await main(...)` at module scope (not inside a function, the named R5 gap) |
| R6 raw-entry-point | dispatch via `isEntryPoint(import.meta.url)` from `scripts/lib/entry-point.mjs` |

Canary hygiene (`docs/testing-doctrine.md`): the self-test uses injected fixtures only, never the
live tree or live DB (three existing canaries break this and red on ordinary work). Independence
proof before pairing: inject a violation into a fixture tree, require the canary GREEN and the check
RED.

## 4. Mutants, workflow steps, red-first proof

**Self-test mutants (each a fixture; each must make `main()` return 1 from the named branch):**

1. A non-wrapper file calls `supabase.rpc('series_command_p5', ...)` -> `door-outside-wrapper`.
2. Same via an untyped helper: `rpc('occurrence_command_p5', args)` -> `door-outside-wrapper`.
3. Backtick spelling `` rpc(`organiser_set_occurrence_programme_v1`) `` -> `door-outside-wrapper`.
4. A door named only in a comment in a non-wrapper file -> GREEN (proves comment stripping; a
   false-red guard is worse than none).
5. A new `organiser_save_workshop_v1` literal anywhere -> `unknown-write-rpc`.
6. The `onboarding_incomplete` row deleted from `COMMAND_COPY` -> `refusal-unmapped`.
7. The row present but not first (after `/^permission_denied/`) -> `refusal-unmapped`.
8. A stale `not_event_writes` entry -> red (ratchet).
9. Live report `{healthy:false}` / `violation_count:1` / `gated:5` -> red (three cases).
10. No creds with `--live` -> 2 from the creds branch; RPC 404 -> 2 from the network branch;
    empty file list -> 2 from the floor branch (branch-pinned, per R5's note that several branches return 2).
11. Clean fixture -> 0.

**Workflow steps (one slice):**

- `db-contract-check.yml`: new step `Run onboarding write-door check`, placed after
  `Run organiser hidden-ids contract check` (the last guard step before `Failure notification`),
  `if: always()`, `timeout-minutes: 2`, env `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`,
  run: `node scripts/check-onboarding-write-doors.mjs --self-test` then `... --live`.
  Comment block in the house style: what it gates on, counts only, canary first.
  This workflow runs on PR to main, push to main and daily 06:00 UTC, so an admin migration that
  drops a gate line goes red here within a day even with no Website PR.
- `architecture-guard.yml`: Part A (static only) as `npm run check:onboarding-write-doors` after the
  legacy-program-RPC guardrail, so a Website PR that adds a door goes red with no secrets.
- `scripts/run-lint-chain.mjs` `LINKS`: add `check:onboarding-write-doors:self-test` immediately
  before `check:onboarding-write-doors` (adjacency is enforced by `tests/lintChain.test.ts`) and
  mirror in `scripts/pre-ship.mjs` `CHECKS` (set membership enforced by `tests/reviewScope.test.ts`).
- `package.json`: the two npm scripts.
- Hard tier: `scripts/**` and `.github/workflows/**` need the owner's Approve at PR head.

**Red-first proof (record in the PR body):**

1. Land the script with `known_ungated: []` FIRST on a scratch branch and run it on today's tree:
   it must go RED on `flows/change/bulkApi.ts:13` (`admin_bulk_occurrence_command_p5` is a write RPC
   not in `gated`). That is the real-tree red-first: the check catches the seventh door that the
   prod guard missed. Then move the name to `known_ungated` (WARN) for the shipping commit.
2. Today's tree has no `onboarding_incomplete` row, so Part A is RED on `refusal-unmapped` until
   the mapping lands in the same slice. Show the red, add the row, show green.
3. For each of mutants 1, 2, 3, 5 apply it to the REAL tree (a scratch edit, not committed), run
   the check, record red with the file:line it named, revert.
4. Part B: run with a deliberately wrong RPC name via an env override in a scratch run -> exit 2.
5. `npm run check:script-conventions` green with no allow-list entry for the new script.

## 5. Open product questions (plain words)

- **Q1 The bulk "change several dates" button.** It lets an owner or manager cancel or move many
  dates in one go, and the server does not check onboarding on it. (a) Gate it like every other
  event change (recommended; matches Q4 "every change"; admin adds one line to
  `admin_bulk_occurrence_command_p5` and fixes the guard's admin test); (b) leave it open on purpose
  and list it in the guard's allow-list with a reason. Must be answered before the flag goes ON.
- **Q2 What the person sees when the server refuses.** (a) The onboarding screen opens, with what is
  left to do (recommended, plan section 6); (b) a one-line message with a "Finish your details" link
  and the change stays on screen.
- **Q3 Should the live guard list door NAMES, not just counts?** Small admin change; lets the Website
  check compare its door list to the server's exactly, so a rename on either side goes red. Recommended yes.

## 6. Not checked / limits

- Did not read the full body of `check_organiser_onboarding_gate_v1`; the split of `discovered: 9`
  (6 gated + 4 allow-listed = 10, so at least one allow-list name is not currently discovered, or
  counting differs) is unexplained. How it classifies "admin-checked" is inferred, not read.
- Did not read the six bodies; only checked that each contains the gate call (not position, not
  count). The live guard asserts position.
- `admin_bulk_occurrence_command_p5`: read only its authorisation lines; did not test it.
- Did not check the admin repo's own callers, edge functions, or `walk-seed.mjs` paths.
- `organiser_save_festival_v1` is missing from the generated types; did not check why.
- No code run; no CI run; regex in 3.A.4 is a starting point and must be tuned against the real tree
  so it has zero false reds on day one.

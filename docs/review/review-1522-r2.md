# Review r2: PR #1522 whole-flyer OG B1, fix round (head f96f7659)

Independent re-review, read-only on the PR branch. PR `123constante/bachata-website#1522`,
branch `claude/whole-flyer-og-b1`, head `f96f7659d506735103c7745fc1af75bd21a50d81`.
Fix delta reviewed: `cb91320b..f96f7659` (5 commits). Brief `docs/briefs/review-1522-r2.md`
(branch `brief/review-1522-r2`, sha 83fcceee). Build brief `docs/briefs/whole-flyer-og-b1.md`;
contract `docs/design/whatsapp-whole-flyer.CONTRACT.md` DRAFT 4. No source edited on the PR
branch; nothing merged or approved. No Supabase call was needed (no data shape is read by the delta).

Severity scale: **BLOCK** / **fix before merge** / **note** (non-blocking).
CONFIRMED = run on this host at head f96f7659; PLAUSIBLE = read but not run.

## Verdict: PASS

Findings 1 to 3 of the first review are fixed at the code, each proven by re-running the
original mutant against the head and by the covering test going red when the fix is removed.
The fix delta stays inside the eight files it names: no workflow, SQL, `.env*` or protected
calendar file; the default mode is still off; the mode-off read path (`app/detailLoader.ts`,
`app/lib/*`) is untouched by the delta. All 39 check runs at the head are green or
skipped-by-design, including `unit (Europe/London, full)`, which was the red job behind
finding 1. The notes below are hardening suggestions, none blocks.

## F1 to F3 status

| # | First-review finding | Status at f96f7659 | How verified |
|---|---|---|---|
| F1 | Golden test pinned text-rendering sha256 hashes that differ by host; `unit (Europe/London, full)` red | **Fixed** (commit 22d6a74) | `tests/ogWholeFlyerGolden.test.ts`: the four text-drawing cases carry `*` for hash and length and are compared byte-for-byte with main's builder call (`buildFallbackCard` / `buildCoverCard`) run in the same test; status, Cache-Control, CDN header, ETag, markers, Content-Type and the decoded size are still pinned. The four text-free cases keep their pinned hashes. Main's dispatch (`api.og.card.tsx` at main lines 272 and 281) matches the inlined `MAIN_FALLBACK` / `MAIN_COVER` calls. `git diff origin/main...f96f7659 -- app/lib/ogCardRender.ts` changes only `buildTallCard` and one import; the two builders compared against are unchanged. Local run under `TZ=Europe/London`: 8/8 pass. CI job `unit (Europe/London, full)` success at head (run 42814100569). Mutant G1 (route passes the title as the venue line) kills 2/8 cases. |
| F2 | `wholeFlyerFailures` did not compare the decoded size to the `s=` of an `l=wf1` URL | **Fixed** (commit 65e9438) | `scripts/check-og-images.mjs:530-536`: for `l=wf1`, `s=` must parse as `^([0-9]{3,4})x([0-9]{3,4})$` and equal the decoded size, else `l=wf1 card decoded size differs from s=`. Mutant re-run (I13): `l=wf1&s=960x1200`, body 1200x630, `X-OG-Layout: wf1`, `max-age=3600`, page declaring 1200x630 now fails on that rule. In `--self-test` (case 9 of the wf cases) and `tests/ogWholeFlyerGuard.test.ts`, which asserts the NAMED rule. |
| F3 | A JPEG with no readable SOF (null width/height) was skipped, not failed | **Fixed** (commit 65e9438) | `scripts/check-og-images.mjs:504-507`: `info && info.format !== 'webp' && !sizeKnown` pushes `cannot read decoded size`; the baked-key size check at line 546 no longer skips on a null size. Mutant re-run (I14, I15): SOI + APP0 + EOI fails under live l-less, live `l=wf1`, baked legacy and baked wf1 URLs. In `--self-test` (case 10) and the guard test with the named rule. |

### Notes 4 to 6 of the first review

The first review's text (`REVIEW-1522-whole-flyer-og-b1.md`) lives on the lead's machine and
was not reachable from this sandbox, so notes 4 to 6 are judged from the fix brief as restated in
`docs/handover-whole-flyer-og-b1.md` and from the code.

| Note | Status | Evidence |
|---|---|---|
| 4 (contract D4 c read rule) | **Left as is**, per the fix brief; no prod effect | No change to `acceptBakedKey` in the delta (`app/lib/ogLayout.ts` not in `git diff cb91320b..f96f7659`). |
| 5 (`?ogtest=whole-flyer` honoured in every non-off mode) | **Fixed** (commit 15b98da) | `app/routes/event.tsx:206`: `OG_LAYOUT_POLICY.mode === "test"`. Table test mode x query (8 cells) in `tests/ogWholeFlyerEventPage.test.ts`, each cell also asserting no fetch to `/api/og/bake`. Mutants C12 (`!== "off"`) and C13 (always) killed. |
| 6 (`--dry-run` demanded `OG_BAKE_SECRET`) | **Fixed** (commit 15b98da) | `scripts/backfill-og-images.mjs:46-53` `missingConfig(opts, env)`: the secret is required only when a bake will be sent. Covered in `tests/ogWholeFlyerLayout.test.ts` (table plus an end-to-end dry run against a PostgREST stand-in, exit 0, no POST; a real run without the secret still exits 2). Mutants C14, C15, C17 killed. |

## Findings (non-blocking notes)

### 1. Guard ignores an `l=` value that is not exactly `wf1` -- note, CONFIRMED
- Where: `scripts/check-og-images.mjs:491-492` reads `l` verbatim; the wf1 rules at 530-536 apply only when `lParam === 'wf1'`.
- Reproduced: input mutant I9, `l=WF1&s=960x1200` answered with a 1200x630 JPEG, `X-OG-Layout: wf1`, `max-age=3600`, page declaring 1200x630: zero failures. I10 (same URL, `legacy-fallback`, 300 s): zero failures.
- Why it does not block: `parseLiveLayout` (`app/lib/ogLayout.ts:159`) compares `l` exactly, so the route answers `l=WF1` with main's legacy card and main's 86400 s cache, which the cache rule (`l=` present, mode not on) does fail in modes off/test/allowlist. The page loader only ever writes `l=wf1` (`setWholeFlyerParams`). A mis-cased `l` can only come from a bug in the URL writer.
- Suggestion (next slice): fail any live URL whose `l` is present and not `wf1` (`unknown l= value`), so a URL-writer bug is named rather than caught sideways by the cache rule only while the mode is not on.

### 2. The golden text cases can no longer catch a change INSIDE the shared builders -- note, CONFIRMED
- Where: `tests/ogWholeFlyerGolden.test.ts:134-139` compares the route's bytes with `buildFallbackCard` / `buildCoverCard` output on the same host.
- Reproduced: mutant G2 (one colour byte changed inside `buildFallbackCard`): 8/8 green. Mutant G1 (dispatch argument changed in the route): 2/8 red.
- Why it does not block: the brief's contract is "l-less URLs byte-identical to main" and this PR does not touch those two builders (diff proves it), so the route-vs-builder equality is exactly the claim the PR can make on every host. The limit is for FUTURE PRs that edit the builders.
- Suggestion: say this limit in the file header (it is implied, not stated), or add a Linux-only pinned hash for one text case gated on `process.platform === 'linux'` so CI keeps a true golden for text.

### 3. Missing or garbled `s=` under `l=wf1` has no fixture of its own -- note, CONFIRMED
- Where: `scripts/check-og-images.mjs:534` `if (!sm || ...)`.
- Reproduced: code mutant C3 (drop the `!sm ||` arm so a missing `s` never fails) survives `--self-test` and the guard test. The rule itself is correct (input mutants I5 `s=abc` and I6 no `s` both fail on the head), only untested.
- Suggestion: one self-test case `l=wf1` with no `s`, body 960x1200, expecting `decoded size differs from s=: s=(none)`.

### 4. Survivors that are equivalent mutants (recorded, no action)
- C7 (baked-key size check reverted to skip on a null size): survives because the new `cannot read decoded size` rule fires on the same fixture; the delta's second line is defence in depth.
- C8 (`s=` regex widened to `{1,4}` digits): survives because the decoded-size equality, not the regex, is the real check (I2 `s=0x0` still fails).
- C11 (`sizeKnown = w || h`): no real JPEG has exactly one zero dimension from a SOF.
- C16 (`willBake = !opts.dryRun`): `--dry-run` without `--layout` is an argv error before `missingConfig` runs (`parseBackfillArgs`, `batch: true` for any flag).

## Mutant table (fix delta only)

Code mutants: one sed on the file, the covering test file run, the file restored (tree clean after each; `git status` empty).

| Id | What changed | Result | Killed by |
|---|---|---|---|
| C1 | `Number(sm[1]) !== w` -> `===` | killed | guard test "healthy: live l=wf1 card"; self-test 1/64 red |
| C2 | `Number(sm[2]) !== h` -> `===` | killed | same |
| C3 | drop `!sm ||` (missing `s` no longer fails) | **survived** | note 3 |
| C4 | drop the `decoded size differs from s=` push | killed | guard test F2 fixture; self-test case 9 |
| C5 | drop the `cannot read decoded size` push | killed | guard test 4 no-SOF fixtures; self-test case 10 |
| C6 | no-SOF rule only for `webp` | killed | same as C5 |
| C7 | baked size check back to `w && h &&` | **survived** (equivalent) | note 4 |
| C8 | `s=` regex `{3,4}` -> `{1,4}` | **survived** (equivalent) | note 4 |
| C9 | `Number(sm[1]) !== w + 1` (off by one) | killed | guard test healthy wf1; self-test |
| C10 | wf1 `s=` block never entered | killed | guard test F2 fixture; self-test |
| C11 | `sizeKnown = w || h` | **survived** (equivalent) | note 4 |
| C12 | event.tsx `=== "test"` -> `!== "off"` (revert note 5) | killed | event page test, allowlist and on cells |
| C13 | event.tsx `?ogtest=whole-flyer` forces in every mode | killed | event page test, off/allowlist/on cells |
| C14 | `willBake = true` | killed | layout test: dry run without secret -> `[]`; e2e dry run |
| C15 | `willBake = false` | killed | layout test: real batch / no-flag run need the secret; exit 2 |
| C16 | `willBake = !opts.dryRun` | **survived** (equivalent) | note 4 |
| C17 | drop the `SUPABASE_SERVICE_ROLE_KEY` push | killed | layout test "Supabase config is still required for a dry run" |
| G1 | route fallback dispatch passes the title as the venue line | killed | golden: "flag off, cover unfetchable", "flag on, cover absent" |
| G2 | one colour inside `buildFallbackCard` | **survived** (design limit) | note 2 |

Input mutants: fixtures run straight through `wholeFlyerFailures` on the head
(`/tmp/.../scratchpad/input-mutants.mjs`, not committed). "killed" = at least one failure string.

| Id | Input | Result | Rule that fired |
|---|---|---|---|
| I1 | `s=960x1200x5` (extra value), body 960x1200 | killed | decoded size differs from s= |
| I2 | `s=0x0`, body 960x1200 | killed | decoded size differs from s= |
| I3 | `s=-960x1200`, body 960x1200 | killed | decoded size differs from s= |
| I4 | `s=99999x99999`, body 960x1200 | killed | decoded size differs from s= |
| I5 | `s=abc`, body 960x1200 | killed | decoded size differs from s= |
| I6 | `l=wf1` with no `s`, body 960x1200 | killed | decoded size differs from s= (s=(none)) |
| I7 | `s=960x1200`, body 1200x960, page declares 1200x960 | killed | decoded size differs from s= |
| I8 | `s=960x1201` (off by one), body 960x1200 | killed | decoded size differs from s= |
| I9 | `l=WF1&s=960x1200`, body 1200x630, header wf1, 3600 s | **survived** | note 1 |
| I10 | `l=WF1&s=960x1200`, body 1200x630, `legacy-fallback`, 300 s | **survived** | note 1 |
| I11 | `s=960X1200` (upper-case x), body 960x1200 | killed | decoded size differs from s= |
| I12 | healthy control `l=wf1&s=960x1200`, body 960x1200 | survived (correct) | none, as intended |
| I13 | F2 original mutant | killed | decoded size differs from s= |
| I14 | F3 original mutant under `l=wf1` | killed | cannot read decoded size; decoded size differs from s= |
| I15 | F3 original mutant under an l-less live URL | killed | cannot read decoded size |

Totals: code mutants 13 killed / 6 survived (4 equivalent, 1 test gap, 1 design limit); input
mutants 12 killed / 2 survived (both the case-of-`l` note) plus the healthy control.

## Tests and self-test (exit codes, this host, Node from `npm ci` lockfile)

| Command | Exit | Result |
|---|---|---|
| `node scripts/check-og-images.mjs --self-test` | 0 | PASS self-test, 64 cases (14 `wf mutant:` / `wf healthy:` lines) |
| `TZ=Europe/London npx vitest run tests/ogWholeFlyer*.test.ts tests/ogBackfillLayout.test.ts` | 0 | 5 files, 136 tests passed (Golden 8, Guard 20, Layout 63, EventPage 13, Card 32; `ogBackfillLayout.test.ts` does not exist on the head, its cases live in `ogWholeFlyerLayout.test.ts`; `ogWholeFlyerReadRule.test.ts` is not in the fix delta and was not run) |
| `npx tsc --noEmit -p .` at f96f7659 | 0 | 0 errors |

## Scope of the fix delta (`git diff cb91320b..f96f7659 --stat`)

8 files, +251 / -51: `app/routes/event.tsx` (one condition), `scripts/backfill-og-images.mjs`,
`scripts/check-og-images.mjs`, `tests/ogWholeFlyerEventPage.test.ts`, `tests/ogWholeFlyerGolden.test.ts`,
`tests/ogWholeFlyerGuard.test.ts`, `tests/ogWholeFlyerLayout.test.ts`, `docs/handover-whole-flyer-og-b1.md`.
Over the whole PR (`origin/main...f96f7659`) no path matches `.github/`, `*.sql`, `.env*`,
`supabase/`, or the protected calendar files. Default mode: `app/lib/ogLayout.ts:46` returns
`"off"` for any value not in the set; the delta does not touch it.

## Per-job CI at head f96f7659 (39 check runs, read 2026-11-10 14:00 UTC)

| Job | Conclusion |
|---|---|
| unit (Europe/London, full) | success (the job red at cb91320b) |
| unit (America/New_York, tz-sensitive) | success |
| unit (Australia/Sydney, tz-sensitive) | success |
| dancer-area-isolation | success |
| e2e-smoke | success |
| phone-qa (1), (2), (3) | success |
| build-smoke | success |
| integrity | success |
| bundle-budget | success |
| contract-check | success |
| live-db-gate | success |
| bom-check, bom-check-routed, route | success |
| notification-check, masking-check | success |
| wallclock-brand | success |
| real-data-verified (x2), phone-qa-section (x2) | success |
| no-preview-reason (x4), decide (x2), open-pr | success |
| seo-check, seo-preview, og-check, og-preview, synthetic, synthetic-preview, lighthouse, doc-weight, enable | skipped (preview-gated or opt-in jobs; skipped by design on this PR) |

No failure, no cancelled, no pending run.

## Verified

- F1 to F3 fixed at the code and by re-running the original mutants on the head; the covering tests go red when each fix is reverted (C4, C5, C12 to C15).
- Self-test and every whole-flyer test file green on this host under `TZ=Europe/London`; tsc 0 errors at the head.
- Fix delta scope: eight named files, no workflow/SQL/env/calendar path, default mode off, mode-off read path untouched.
- All 39 CI check runs at f96f7659 success or skipped.

## Not verified

- The first review's own text: `REVIEW-1522-whole-flyer-og-b1.md` is a local file on the lead's machine; findings 1 to 6 were taken from the fix brief as restated in the PR's handover doc. If the first review had further notes beyond 1 to 6, they are not covered here.
- `npm ci` was not re-run: this sandbox clone came with `node_modules` installed from the unchanged lockfile (`package-lock.json` identical between main and the head; no symlinks at the top level of `node_modules`).
- Vercel preview walk of `/event/...` with `?ogtest=whole-flyer` at 390x844: not in this brief's scope and not done.
- `tests/ogWholeFlyerReadRule.test.ts` (not in the fix delta) was not run.
- The skipped CI jobs are judged "skipped by design" from their names and the PR having no preview-gated change; the workflow conditions were not read.

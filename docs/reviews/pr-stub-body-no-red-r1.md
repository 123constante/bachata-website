# Review r1: PR #1149 -- bot PR body pre-fill + PENDING exit 3 (CI guard, hard tier)

Reviewer: independent cloud worker (ticket `dt_834e89ba310c`), did not build this.
Reviewed head: `40ad7a913c10de0e6ed67bf2adebea9bb8c77a5d` on `claude/pr-stub-body-no-red`.
Brief: `docs/briefs/review-pr-stub-body-no-red.md` (branch `brief/review-pr-stub-body-no-red`).
Inputs read: PR body, `docs/handover/pr-stub-body-no-red.md`, the original brief
`docs/briefs/pr-stub-body-no-red.md`, the full diff against `main` (5 files),
`scripts/automerge-classify.mjs`, `scripts/check-pr-mergeable.mjs`,
`.github/workflows/bot-automerge.yml`, `docs/automerge.md`.

## Verdict: FIX FIRST

One BLOCK. The brief's first review question is "can a body still containing
`TO FILL` EVER reach merge?" and the answer at this head is yes (finding 1):
the parser reads only the FIRST line per label, so a session that pastes its
three filled lines ABOVE the bot's three marker lines gets exit 0, `ok: true`,
and `automerge-classify` qualifies the PR. The fix is a few lines in
`parse()` plus a red-first test; everything else in the PR holds up.

## Findings

### 1. BLOCK -- a filled line placed above a leftover marker line is a PASS, and auto-merge accepts it

`scripts/check-pr-real-data-verified.mjs:91-98` (`labelValue` returns
`hits[0]`) and `:154-161` (the marker test runs only on that first hit).

Failing scenario, run against the PR head with the real `parse` and the real
`classify` from `scripts/automerge-classify.mjs`:

```
## Verified on real data
- Shapes surveyed: events table, 412 rows, null venue_id in 9
- Checks run: matrix tests plus a browser walk at 390x844
- NOT verified: behaviour with more than 1000 occurrences
- Shapes surveyed: TO FILL
- Checks run: TO FILL
- NOT verified: TO FILL
```

Result: `exit=0 ok=true pending=false automerge-qualifies=true`. The body still
contains `TO FILL` three times, the check run is green, and a docs-only bot PR
with the `automerge-ok` label would be auto-merged. The mirror shape (filled
lines appended BELOW the markers) is exit 3 / pending, so the verdict depends
on which way round the session pasted. Same hole with a marker on a non-label
line inside the section (`- Browser walk: TO FILL` after three filled lines):
exit 0.

This shape is new exposure introduced by this PR: `main`'s parser also passes
it, but on `main` no body ever carries the marker. It is also a realistic
shape: until today every session APPENDED its own section to a stub that had
none, so pasting a block next to the bot's lines is the habit the pre-fill
meets.

Fix (parser only, no workflow change): count a marker on ANY line of the
comment- and fence-stripped section, not only on the first hit per label.
Concretely, after `const section = lines.slice(from, to)`, treat every section
line containing `MARKER` as a marker problem (naming the line), and make
`labelValue` either take all hits or reject duplicate label lines (finding 2).
Add red-first table rows for: filled-above-markers, filled-below-markers,
marker on a non-label section line; assert `ok: false`, `pending: true`,
exit 3, and `classify(...).qualifies === false` for the first one.

### 2. SHOULD-FIX -- duplicate label lines are silently resolved first-wins

`scripts/check-pr-real-data-verified.mjs:96-97`. Pre-existing, but it is the
mechanism behind finding 1 and it hides a second class: two `- Checks run:`
lines where the first is a placeholder and the second is real text is a
violation, where the reverse order passes. Either reject `hits.length > 1`
("label appears N times; keep exactly one", mirroring the doubled-heading
rule) or evaluate every hit and fail closed on the worst one.

### 3. SHOULD-FIX -- "pending" is a `success` conclusion; record that green now has two meanings

`.github/workflows/real-data-verified.yml:82-86`. Actions job steps cannot
publish a `neutral` conclusion, so the implemented PENDING state is a green
check with a `::notice` and a step-summary line. That is the best a `run:`
step can do and the workflow comment says so, but CLAUDE.md keeps the list of
"guards whose green is narrower than it looks" in
`docs/ci-guard-notes.md`, and this PR does not touch that file. Add the
entry there: `real-data-verified` green = filled OR still pending; the job's
annotation / summary is what distinguishes them, and the check must become
red for exit 3 if it is ever added to the `main checks` ruleset. Without the
doc entry, the next person who sees a green `real-data-verified` on a PR with
`TO FILL` in the body has nothing telling them that is expected.

### 4. NIT -- a session that appends a second section goes red with "appears 2 times"

`.github/workflows/bot-pr.yml:10`. Correct behaviour (the old doubled-heading
rule), but it is the most likely first-contact friction with the pre-filled
body. One sentence in the bot-pr.yml header ("replace the three `TO FILL`
lines; do not add a second section") and in the PR template would save a red
run per session that still has the append habit. The usual `gh api -X PATCH`
whole-body replace is unaffected.

### 5. NIT -- `TO&nbsp;FILL` passes the length check

`scripts/check-pr-real-data-verified.mjs:111`. `stripPunct` turns the HTML
entity into the word `nbsp`, so `to nbsp fill` is exactly 12 characters and
passes MIN_CHARS. Not a path from a forgotten marker (nothing in GitHub
rewrites `TO FILL` that way), and pre-existing: any 12 characters of junk
pass. Noted so nobody later counts it as a marker bypass.

### 6. NIT -- `tests/realDataVerified.test.ts:187` evaluates workflow text with `new Function`

Acceptable in a test over repo-owned YAML, and it is what pins bot-pr.yml's
body to the parser (mutation D below proves it). Just keep the regex anchored
to `const body = [ ... ].join("\n")` as the comment in bot-pr.yml asks.

## Review questions from the brief, answered

1. **Merge paths.** `bot-automerge.yml` -> `automerge-classify.mjs:152-155`
   requires `realData(body).ok === true`; a pending body is `ok: false` and is
   refused (pinned by the "does NOT qualify" test, and reproduced here). The
   `main checks` ruleset per `docs/automerge.md:119-124` (read 2026-10-08) does
   not require `real-data-verified`, so a manual merge was never blocked by
   this check and still is not; not re-read live. `check-pr-mergeable.mjs`
   counts any Actions check run as a gate that RAN (presence, not pass) and
   never reads conclusions for pass/fail, so pending vs red changes nothing
   there. `owner-approval-audit.mjs` reads neither the body nor this check.
   BUT finding 1: a body containing `TO FILL` CAN reach merge through
   `bot-automerge` when the filled lines sit above the marker lines.
2. **Checker shapes** (all run against the head parser; exit / ok / pending):
   marker on 1, 2, 3 lines -> 3 / false / true. Marker mixed with real text ->
   3 (fail-closed). `**TO FILL**`, `` `TO FILL` ``, `~~TO FILL~~`, CRLF, inside
   `<details>` -> 3. Marker only inside a ``` or ~~~ fence -> the fence is
   stripped; with a real section outside it decides, with nothing outside it
   is "section missing" (exit 1). Inline "```npm test``` passes" is not a
   fence (fixed in the recorded first review). Old bot stub -> 1. Marker in an
   HTML comment on the line -> "empty after the colon", exit 1. Spellings that
   are NOT the marker and all stay exit 1 (too short): `to fill`, `To Fill`,
   `TOFILL`, `TO  FILL`, `TO<nbsp>FILL` (U+00A0), `TO<zwsp>FILL`, fullwidth
   letters. No spelling turns a forgotten marker into a pass; the only passes
   with `TO FILL` present are the duplicate-line / non-label-line shapes in
   finding 1. Docs-only skip: unchanged in the workflow (lines 52-61) and
   pinned by the wiring test.
3. **bot-pr.yml injection.** Title and body are built inside a single-quoted
   `node -e` script from `process.env` only, written to `pr.json`, and sent
   with `--data @pr.json`; no PR-controlled text reaches a shell command. A
   branch name cannot contain a newline, so it cannot inject a second
   `## Verified on real data` heading (headings are line-anchored). The
   `::notice` text in real-data-verified.yml is static and `$code` is a
   number. Safe. (Pre-existing and out of scope: `$BRANCH` is interpolated
   unencoded into the `pulls?head=` query URL at line 42.)
4. **Tests.** Table-driven (`it.each`) for the marker, fence and wiring cases.
   Red-first is claimed as 22 failures; not re-run against `main`'s parser
   here, but every `toEqual({ ok, pending, problems })` assertion fails on
   `main`'s two-field return, so the claim is structurally true. Mutations run
   here on the head: (A) marker check removed -> 6 tests + `--self-test` fail;
   (B) pending counted as ok -> 7 tests + `--self-test` fail; (C) workflow
   `exit "$code"` -> `exit 0` -> 1 test fails; (D) bot-pr.yml body drops the
   heading line -> 1 test fails. `check-script-conventions.mjs` green at head
   (85 known violations, unchanged).
5. **Workflow edits.** Only `bot-pr.yml` and `real-data-verified.yml` changed;
   `bot-automerge.yml` untouched. The PR body's "Why these two workflow files"
   paragraph states the reasons, matching brief steps 1 and 2.

## Verified

- Worktree at `40ad7a9`: `node scripts/check-pr-real-data-verified.mjs
  --self-test` PASS (15 cases); `vitest run tests/realDataVerified.test.ts
  tests/automergeClassify.test.ts` 125/125; `node
  scripts/check-script-conventions.mjs` green.
- The four mutations above, each reverted.
- The finding-1 scenario and 25 parser edge shapes, run with the head parser
  and the real classifier.
- PR #1149 check runs at `40ad7a9` when read: integrity, bundle-budget,
  bom-check, masking-check, wallclock-brand, notification-check,
  dancer-area-isolation, contract-check, live-db-gate, phone-qa-section,
  real-data-verified (skipped-green, no src/), unit NY and Sydney legs all
  success; `unit (Europe/London, full)` and `e2e-smoke` still in progress.

## Not verified

- The `main checks` ruleset's live required-check list (no `gh api` in this
  worker; taken from `docs/automerge.md` as of 2026-10-08).
- The PENDING notice rendered inside a real `real-data-verified` run on a
  src/-touching bot PR (none exists yet).
- The builder's 20-PR real-data survey; not repeated.
- Final conclusion of `unit (Europe/London, full)` and `e2e-smoke` on
  `40ad7a9`.

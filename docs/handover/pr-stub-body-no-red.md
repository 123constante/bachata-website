# Handover: bot PRs no longer go red on the stub body (GUARD-CI, hard tier)

Brief: `docs/briefs/pr-stub-body-no-red.md` on branch `brief/pr-stub-body-no-red`.
Branch: `claude/pr-stub-body-no-red`. Ticket `dt_7f43f24d3a79`.

## Done

1. `.github/workflows/bot-pr.yml` opens every claude/** PR with a body that
   already carries `## Verified on real data` and the three labelled lines set
   to `TO FILL`, plus the existing "Opened by the bot" lines. Still built in
   `node -e` and passed via `pr.json` (`--data @pr.json`), never interpolated
   into a shell command.
2. `scripts/check-pr-real-data-verified.mjs`:
   - `MARKER = 'TO FILL'` (case-sensitive, so prose "to fill" is not it).
   - `parse()` now returns `{ ok, pending, problems }`. `pending` is true only
     when EVERY problem is a marker line; a marker beside a real violation
     (missing line, placeholder) is a violation. `ok` is false whenever a
     marker is present.
   - Exit 3 = pending (documented in the header). 0 / 1 / 2 unchanged.
   - Fenced code blocks (``` / ~~~) are removed like HTML comments, so a
     section or marker quoted in a fence is not the PR's own section.
   - `--self-test` gained pending (3) and marker-plus-violation (1) exits and a
     fenced-only case.
3. `.github/workflows/real-data-verified.yml`: exit 3 becomes a
   `::notice` + step summary line ("waiting for the description to be filled
   in") and exit 0; every other code is passed through (red). Docs-only skip
   unchanged.
4. Tests (`tests/realDataVerified.test.ts`, red first: 22 failed before the
   parser change): marker on 1/2/3 lines, marker mixed with real text,
   lowercase marker, marker beside a missing line / placeholder, marker in a
   fence, filled body, OLD bot stub (stays exit 1), the body `bot-pr.yml`
   actually writes (evaluated from the YAML) is exit 3, a pending body does
   NOT qualify for bot auto-merge (real `classify` + real `parse`), and the
   workflow wiring (docs-only skip kept, only exit 3 neutralised).

## Mutations run

- Marker check removed (`raw.includes(MARKER)` -> `false`): 6 tests + the
  self-test fail. Reverted.
- Pending counted as ok (`ok: problems.length === markers`): 7 tests fail,
  including "pending body does NOT qualify for bot auto-merge". Reverted.

## Merge paths checked (brief step 3)

| Place | Treats real-data-verified green as mergeable? | Result |
|---|---|---|
| `bot-automerge.yml` -> `scripts/automerge-classify.mjs` | reads `parse(body).ok` directly, not the check run | pending keeps `ok=false` -> NO. Pinned by a test. No edit needed. |
| `main checks` ruleset (id 24574372, per `docs/automerge.md`, read 2026-10-08) | required: integrity, bundle-budget, e2e-smoke, wallclock-brand, masking-check, bom-check, unit (Europe/London, full) | `real-data-verified` is NOT required, so neither red nor pending blocks a manual merge, same as before. Comment added in the workflow: if it is ever made required, pending would satisfy it and must become red there. Not re-read live (no `gh api` in this worker). |
| `owner-approval.yml` / `scripts/owner-approval-audit.mjs` | post-merge audit of hard-tier approvals; never reads the body or this check | not a merge path; unchanged. |
| `scripts/check-pr-mergeable.mjs` | reads check conclusions for gate contexts | not keyed on real-data-verified; unchanged. |
| `dependabot-automerge.yml` | dependabot PRs only | out of scope; unchanged. |
| `~/.claude` pr-status | brief: out of scope | not touched. |

## Real-data survey (read-only, public REST, last 20 `kiki-claude-bot` PRs)

old-stub 9, filled-pass 8, violation 3, pending-marker 0 (none yet), fenced
code in body 0. The new parser's ok/not-ok verdict differs from main's on 0
of 20.

## Found, not fixed (out of scope)

- The 3 "violation" PRs (#1147, #1139, #1138) filled the TEMPLATE as written:
  `- Shapes surveyed (read-only, counts): <real text>`. The parser only reads
  `Label:` with the colon right after the label, so the template's own line
  shape is "line is missing". Owner decision: either the parser accepts
  `Label (hint): value`, or the template moves the hint after the colon.
- `bundle-budget`: a LOCAL build here measures dancer-app at 374.1 KB vs a
  374 KB budget, but the CI `bundle-budget` run on PR head `40ad7a9` was
  success. This PR changes no src/; the 0.1 KB is a sandbox build difference.
  (Corrects the earlier "red on main" note.)

## Next steps

- Owner: approve at PR head (hard tier: workflow + scripts), then merge.
- After merge, the next bot PR should show real-data-verified as a notice
  ("PENDING") until its session edits the body.

## Independent review (different model, one round -- CI-guard stopping rule)

- FIXED: an inline span like "```npm test``` passes" opened a fence and hid a
  filled section (exit 1). Opening backtick fences now reject a backtick in the
  info string (CommonMark). Red-first test added, plus ~~~, info-string,
  indented and longer-fence cases.
- KEPT: an unclosed fence runs to the end (CommonMark); fail-closed.
- KEPT: `TO FILL` anywhere in a line = pending (fail-closed; a real line
  naming a "TO FILL column" stays pending until reworded). Pinned by the
  "marker mixed with real text" test.
- KEPT: pending is a green run; the workflow comment says it must become red
  if the check is ever made required.

## Fix round r1 (`docs/reviews/pr-stub-body-no-red-r1.md` on `claude/review-pr-stub-body-no-red`)

- FIXED finding 1 (BLOCK): a marker on ANY line of the comment- and
  fence-stripped section is now a marker problem (label line or not), so
  filled lines pasted ABOVE the bot's marker lines are exit 3 pending and
  `automerge-classify` does not qualify. Marker lines are left out of the
  label checks, so the leftover copy of a label is not also a duplicate.
- FIXED finding 2: a label on two non-marker lines is a violation
  ("line appears 2 times; keep exactly one"), either order. No first-wins.
- FIXED finding 3: `docs/ci-guard-notes.md` records that a green
  `real-data-verified` now means filled OR pending, and that exit 3 must turn
  red before the check is ever made required.
- FIXED finding 4: bot-pr.yml header and the bot body itself say to replace
  each TO FILL in place and not add a second section.
- KEPT findings 5 and 6 (nits, pre-existing / acceptable as the review says).
- Red first: 8 of the new rows failed on `40ad7a9` (filled-above-markers,
  marker on a non-label line, marker in free text, marker beside a
  duplicated label, the auto-merge row, three duplicate-label rows).
  Filled-below-markers was already pending there, as the review found.
- Mutations, each reverted: M1 marker scan removed -> 12 tests + self-test
  fail; M2 duplicate check removed -> 5 + self-test; M3 marker lines kept in
  the label checks -> 8 + self-test; M4 marker counted on label lines only
  -> 2 tests fail (the non-label rows).
- Real data: last 20 bot PRs (#1131..#1154): verdict differs from main's
  parser on 0; the duplicate-label rule hits 0 of the last 60 PRs.
- CI steps rerun locally: all green except the 5 `integrityCouldNotRun`
  unit cases (same failures on origin/main in this sandbox) and the local
  bundle-budget 0.1 KB (above). e2e-smoke 159/159 (6 skipped).

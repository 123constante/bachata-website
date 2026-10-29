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
- `bundle-budget` (a REQUIRED check) is red on `main` itself (dancer-app
  374.1 KB vs 374 KB budget). This PR changes no src/, so it inherits it. No
  fix PR found.

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

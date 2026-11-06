# Handover: fix-main-red-identity-web (Website)

Branch `claude/fix-main-red-identity-web`, ticket dt_4f19f330c3d3, brief v1
(`brief/fix-main-red-identity-web`). Owner decision 2026-11-05: drop the
`["author","merge"]` pair.

## Done
- `.github/automation/secrets-register.json`: `separate_roles` is now
  `[author, approver]`, `[merge, approver]`. `AUTOMERGE_TOKEN` `exists: false`
  with the dated note; `BOT_PR_TOKEN` `acts_as: kiki-claude-bot` (measured
  2026-11-05, run 41990183311).
- DEVIATION from the brief's file list (needed): `scripts/check-secrets-register.mjs`
  rule (a) reds any workflow that reads an `exists: false` secret, and
  `autopilot.yml` (not to be touched) and `automation-identity-check.yml` still
  name `secrets.AUTOMERGE_TOKEN`. Rule (a) now accepts such a reader only when the
  entry's `absent_readers` gives a dated reason for that workflow; a stale row,
  or a row on an `exists: true` entry, fails. Five new self-test cases.
- `automation-identity-check.yml` NOT changed: the script measures only
  `exists: true` entries, so the empty `AUTOMERGE_TOKEN` is not read; an
  `exists: true` credential missing from env is still exit 2.
- Tests: identity mechanism tests now use a fixture (pair kept, both PATs
  `exists: true`) instead of the shipped register; new describe pins the
  shipped pairs, the CI shape (BOT_PR_TOKEN -> kiki-claude-bot, AUTOMERGE empty
  = exit 0), owner login = red, mismatch = red, missing = exit 2, rules (a)-(f)
  clean on the real workflows, stale `absent_readers` = red.
- Docs: `docs/automation-foundations.md`, `docs/handover/foundations-web.md`.

## Not verified
- The live `automation-identity-check.yml` run (runs on push to main of the
  register; needs merge, then check the run is green).
- `kiki-claude-bot` login is taken from the brief's reading of run 41990183311,
  not re-measured here (no token in this session).

## Next
- Owner: approve the GUARD-path change (register + check script) and merge.
- After merge, confirm the push-triggered identity run is green.

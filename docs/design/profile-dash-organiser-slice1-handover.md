# Organiser dashboard slice 1: handover (PARTIAL, blocked before any code)

Ticket dt_2e6370c69a6b. Branch `claude/profile-dash-organiser-slice1` (from origin/main bba5711).
Brief: `docs/briefs/profile-dash-organiser-slice1.md` on `brief/profile-dash-organiser-slice1` (blob 62db97b).

## Done
- Read the brief, `docs/design/profile-dash/organiser.md` (inventory + GAPs) and the sibling briefs.
- No `src/` change, no DB access, no PR.

## Blocker (why nothing was built)
1. The brief's contract is "comments on 123constante/bachata-admin#1535 and #1531. Quote, do not guess."
   This cloud session has no access to `bachata-admin-11april` (`add_repo` returned "not found / no
   access"), and `gh` is unavailable. So the DESIGN PICKED comment and the contract text were not readable.
2. The closest text on this repo is `brief/profile-dash-organiser-a-fixes`
   (`docs/briefs/profile-dash-organiser-a-fixes.md`): 8 numbered fixes + 1 "minor" = probably the "9 listed
   fixes". It is NOT confirmed to be the same list as the issue comment.
3. `organiser.md` GAPs say several reads do not exist yet (per-night opens and per-type clicks, a
   cancelled-aware read, organiser-page link, whole-team access to analytics). The brief forbids DB
   changes, so which existing RPCs may feed each tile is a contract question for the issue text.

## Next steps (for whoever has admin access)
1. Paste the #1535 DESIGN PICKED comment and the #1531 contract into the brief, or give the session admin-repo access.
2. Build in `src/modules/organiser/p3/` (HomeScreen.tsx, model/status.ts, data/home.ts are the files
   `organiser.md` cites). Do not touch dancer files.
3. Table-driven vitest, screen x shape: new, upcoming, zero, huge (cap list, "See all N"), cancelled
   (live nights only), selling, loading, error, contributor seat.
4. Real-data shape survey (prod read-only), 390x844 shots, `docs/design/<pr>.md`, PR body with the two
   exact label sections.

## Not verified
Everything: no code written, no tests, no tsc, no CI, no screenshots.

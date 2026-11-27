# CLAUDE.md - Website (Bachata Calendar public site)
React + TypeScript + Vite + Supabase + Vercel. Mobile-first (~95% phones). Zero migrations here; schema authority is `bachata-admin-11april`. Detail: docs/website-rules-detail.md#<section>
Binding: `.claude/rules/*.md` and `src/modules/event-page/CLAUDE.md` (detail#architecture). Keep Vite manual chunks: `vendor-react` carries tslib (read the comment in `vite.config.ts` before moving it); the `vendor-ui*` lists are measured, not judged.

## Density exclusions: no density changes to
src/components/EventCalendar.tsx, src/components/calendar/{CalendarGrid,CalendarListView,DayDetailModal}.tsx, src/components/calendar/calendarUtils.ts, src/hooks/useCalendarEvents.tsx. Do not alter shared `src/components/ui/dialog.tsx` for calendar work. Ask Ricky first.

## Migration authority (detail#migration-authority)
`supabase/migrations/` must NOT exist here (`check-migration-stamps.mjs` reds it): no `*.sql`, no hand-applied DDL; author DDL in the admin repo first. New contract checks go in `scripts/check-*.mjs`. Never pin a check count in prose: `grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`.

## File-write safety (detail#file-write-safety)
Source files over 2 KB: `scripts/safe-edit.py` (surgical) or `scripts/safe-write.py` (full-body: new files, whole rewrites, any safe-edit refusal); the hook refuses raw Edit/Write and prints the call. A payload containing `@@SAFE-EDIT-*@@` marker lines or a bare `HUNK` line at column 0 breaks safe-edit: use safe-write. `.md` is unguarded. Foreign session lock: use a `git worktree`. Recovery: `npm run check:integrity`, `npm run repair:corrupt`.

## CI traps (detail#ci-workflows)
- `architecture-guard.yml` does NOT run eslint.
- A conflicting PR's `pull_request` workflows never queue (gates vanish, Vercel stays green): `npm run check:pr-mergeable`.
- Read `check-script-conventions.mjs`'s six rules before writing a guard. `check-og-images.mjs` needs a live deploy: `npm run check:og`.

## Testing (detail#testing)
`npm run test:unit`; `npm run test:e2e` (explicit spec list: add by name); `npm run lint` (its final `eslint .` does not gate; `pre-ship` does). `check:legacy-tables` / `check:legacy-program-rpcs` red: fix the call site, not the check.

## Dell prod walk (owner 2026-11-24)
After a merged PR with a visible UI change, the Dell walks production at 390x844: every button vs the PR tap table, keep-list unchanged, screenshot vs approved mockup; fail = roll back. Detail: docs/website-rules-detail.md#dell-prod-walk.

## Definition of done (detail#definition-of-done)
The global five points on real prod SHAPES (project `stsdtacfauprzrdebmzg`, read-only counts, no personal data, never any write; include lists over the 100-row API cap) plus a "Verified on real data" PR block. Phone `html` font is ~13.5px: use explicit px for tap targets.

## HTML entities
JSX uses `&mdash;` `&hellip;` `&rsquo;`; no raw Unicode punctuation in source.

## Operating model (detail#operating-model)
Say the class (TRIVIAL/BUILD-visual/BUILD-non-visual/MIGRATE/GUARD-CI/PERF/AUDIT/ARC). `/code-review` before commit; findings become edits, never follow-up commits. State the stopping rule before a review round: ONE round, risky classes only (owner click 2026-11-12; was two for user-facing); a finding proved by MUTATION (the gate stays green against the mutant) means revert now and queue the defect, no further round; fixes to findings are unreviewed code. `npm run pre-ship`. One PR per unit, push once. No changelog: `git log`.

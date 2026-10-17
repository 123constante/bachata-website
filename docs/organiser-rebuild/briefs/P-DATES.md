# Brief P-DATES -- parity fix pass, everything about ONE DATE (Website)

Repo `123constante/bachata-website`. Branch `claude/org-r1-parity-dates`, cut from `claude/org-r1-integrate` (head e04dea0 or newer). Push ONLY that branch, ONCE at the end (plus one PARTIAL push if you hit the context limit; a continuation worker per slice is normal). Plain git only (never `gh api`), commands without variables/loops/`$(...)`, never `--no-verify`.

READ FIRST: `git show origin/claude/org-r1-parity:docs/organiser-rebuild/PARITY-GAP.md` (the audit, rows C13..C61, the "sessions question" section and the "(b) smallest change" table), `docs/organiser-rebuild/briefs/00-COMMON.md`, and the appendix `parity/commands-roles.md` on the same branch. Another worker (P-SERIES) runs in parallel on `claude/org-r1-parity-series`; you do NOT touch its files (below).

## Owner mandate (2026-10-17)
"Be complete with all the features that the admin editor has" for everything an organiser is ALLOWED to do on prod (owner/manager). Admin-only things stay out. The owner will judge the result himself on a phone, so build every row below, none skipped. Owner decisions: Cancel and Take off live in Change; Move date hidden until admin A1; sessions are the priority.

## Build (all of these, with the audit row ids)
1. **Sessions + line-up for ANY date (C13, C22, C52-C55, C59).** `flows/change/WhatChanges.tsx` gets a row "Sessions and line-up" -> `ORG_PATHS.dateLineup(seriesId, occurrenceId)`. Every Coming-date row in `events/OneEvent.tsx` (dates list part only) and in `flows/change/WhichDate.tsx` opens the same editor. Existing `dates/DateSheet.tsx` + `organiser_set_occurrence_programme_v1`; honour its refusals (multi-day, cancelled, past) with a visible reason, never a dead button.
2. **Change time shows the sessions (C19, C61)** -- implement exactly the 5-point spec under "What Change time would need to show" in PARITY-GAP.md: read sessions via `organiser_get_occurrence_programme_v1`; 1 session = start + optional end; 2+ sessions = list + one new-start box + live preview of every new time + the line "Every session moves by <delta>"; row "Change one session's time" -> the per-date session editor; "Back to usual time" (`{reset:true}`) only when the date has a time change. `occurrence.set_time` stays ONE pinned command.
3. **Cancel and Take off from Change (C23, C24, C25)** for ANY coming date, not just the next: Change "what" gets "Take this date off" (`series.skip_date`, rule dates) and "Cancel this date" (with reason; reuse flows/cancel confirm); put-back stays as is. Cancel is still the same command as `flows/cancel`; do not fork it.
4. **Note / picture / ticket link for one date only (C26)**: rows in Change what -> `occurrence.set_override {description | ticket_url | cover_image_url}` (keys at shared/seriesCommands.ts:113-115). Untouched save sends nothing.
5. **Past dates list (C39)**: collapsed "Past dates" in `events/OneEvent.tsx` using the existing unimported `DatesList` (events/EditorRows.tsx:75).
6. **Move date (C20)**: keep `flows/change/Day.tsx` but the row is HIDDEN behind the shared gate `A1_APPLIED` (below) because prod refuses `occurrence.move_date` as "admin-only" until admin A1. Test: row absent when false, present when true.
7. **Bulk cancel / bulk shift (C58)** -- allowed for owner/mgr via `admin_bulk_occurrence_command_p5` (audit says it admits owner/mgr, Website never calls it). VERIFY on prod read-only (pg_get_functiondef) before building; if it admits owner/mgr, build "Pick several dates" in Change: tick dates, then Cancel (reason) or Move by N days, one confirm showing the count, result "N done, M refused" with reasons. If it does NOT admit them, do not build; write the proof in the handover.
8. **Copy one date's changes to another (C60)**: "Copy changes from another date" on the date's Change screen, copying the six owner override keys (venue, description, cover, ticket link, ...) as one `set_override` per changed key; disabled with a reason when the source date has none. Verify the keys on prod first.

## Pinned interface with P-SERIES
- File `src/modules/organiser/shared/a1Gate.ts`, BYTE-IDENTICAL in both branches (so the merge is clean). If absent on your base, create exactly:
```ts
// Flip to true in the merge train once admin A1 (migration 20261126190000) is applied on prod.
export const A1_APPLIED = false;
```
- P-SERIES owns: `events/Details.tsx`, `events/EditorSheet.tsx`, `flows/event/**`, `flows/new/**`, `flows/Done.tsx`, `jobs/homeJobs.ts`, a NEW `events/LifecycleActions.tsx`. You own: `flows/change/**`, `flows/cancel/**`, `dates/**`, `events/EditorRows.tsx`, and the dates part of `events/OneEvent.tsx`. P-SERIES adds ONE line mounting `<LifecycleActions/>` in OneEvent.tsx; leave that region alone. Shared files (`shared/seriesCommands.ts`, `shell/paths.ts`): additive hunks only.

## Rules that bind (owner CLAUDE.md, summarised)
- **Red-first**: for every row, write the table-driven test (or the failing assertion) FIRST, run it against the unfixed code, paste the failing output into the handover. A test that cannot fail proves nothing.
- Consistency matrix: extend the S8 matrix so every screen x every shape reads the same fact the same way; no copy pointing at a control that is not on screen; every empty state says what the person CAN do; a control that cannot work is disabled WITH a reason; saving an untouched record sends nothing.
- Prod-shaped fixtures (read-only prod survey, counts only): 67 live series, 53 with 2+ sessions a day, 44 weekly, 11 with per-date time overrides, 13 date-only added sessions, 18 session overrides, series with 0/1/2-9/10+ coming dates, multi-day dates, cancelled and past dates.
- CI without paying GitHub: GitHub may refuse jobs ("payments have failed"); that is not a code failure. Run EVERY CI job step yourself in your sandbox (read `.github/workflows`: lint chain, `lint:architecture`, `check:images` with AUDIT_STRICT=1, typecheck, unit, e2e, `npm run build` PRODUCTION build, perf budgets) and put the per-job table (command, exit code) in the handover. Do not edit workflows.
- Phone: tap targets >= 44px explicit px; `&mdash;` entities, no raw Unicode punctuation; every `<img>` has `loading`/dimensions per check:images; one lazy chunk per folder; links only from `ORG_PATHS`; compact density.
- Supabase: SELECT only on prod `stsdtacfauprzrdebmzg`, counts only; never write; E2E project `srrpvuxldthwumzrngla` for anything that needs data.
- Context: under 30%; at 25% start nothing new; by 30% push + handover with last commit subject ending `PARTIAL [worker-done dt_xxx]`. Final push subject ends `[worker-done <ticket>]`.
- Handover `docs/organiser-rebuild/handovers/P-DATES.md`: done / left (with exact next steps) / per-job CI table / red-first evidence / Verified-Not verified (say plainly: no real-phone run, no live storage) / any decision you made, with the reason, for the review pack.

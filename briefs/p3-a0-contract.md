# Brief: P3 slice A0 -- survey + server contract (read-only, docs only)

Lane: careful. Branch: claude/p3-a0-contract (Website). Output is DOCS ONLY: no src/, no SQL, no migrations. Supabase is read-only (project stsdtacfauprzrdebmzg), counts only, no personal data.

## Goal
The owner approved building the P3 organiser redesign (mockup C3) behind a flag `organiserP3`, with the server gaps built FIRST in the admin repo (123constante/bachata-admin, migrations there). This slice produces the contract the server and Website slices build against.

## Read first
- Plan: summarised below. C3 spec: PR #989 branch claude/er-p3-mock-c3, docs/organiser-rebuild/p3/mockups/C3.md and C3.html (behaviour: dsess, startPhrase, classCount, cast). Critique #991 (claude/er-p3-critique-c3, docs/organiser-rebuild/p3/CRITIQUE-C3.md). Sim reports #995-997. Test page #1003.
- Main organiser code: src/modules/organiser/** (flows/change, add, new, event, cancel, fix). RPCs in use: organiser_home_v1, admin_event_workspace_p5, series_command_p5, occurrence_command_p5, admin_bulk_occurrence_command_p5, organiser_series_cast_v1, event_view_p5.
- Website rules: CLAUDE.md, .claude/rules/data-contracts.md. Read live function bodies from pg_proc (read-only), never guess.

## Deliver (write docs/organiser-rebuild/p3/CONTRACT.md, plus one handover doc)
1. Shape survey on prod (counts only): events by lifecycle/status x kind (series, one-off, course, monthly, dates-I-pick, festival) x number of sessions x number of dates x cancelled/past x lists over the 100-row API cap x empty line-up x per-date overrides present.
2. Screen -> RPC map for every C3 screen and sheet (list in C3.md "New screens/sheets" and GAP LIST coverage): which live RPC serves it, or "GAP".
3. The gap list, each with proposed server contract (inputs, outputs, error codes, ACL, idempotency), sized as admin migrations A1-A3:
   - A1 "this and later" as ONE forward rule on the series session (from:[{d,p}], applied after base, before per-date overrides; later cancels survive); reader + command.
   - A2 per-date name/music/photos/price overrides; date regeneration when Repeat/course rules change (monthly, 500-date cap, course length excludes breaks/cancelled).
   - A3 error codes (contract_violation, has_bookings + existing 12), History/Undo for same-day changes, Make-a-copy draft.
   Say which C3 open items (C3.md "Open / phase 4": #24, #25, #26, #27, #28, #59, #63, #71, #81, #148) fall inside P3 and which do not, with a recommendation.
4. For each gap: which current Website readers/writers break, and which CI contract checks (scripts/check-*.mjs) to add.
5. Conflicts with event-truth P1 (eventCategory, Type derived from sessions; PR #750, branch feat/event-truth-p1p3) and with going/people work on main.

## Done =
PR with CONTRACT.md + handover, per-job CI table in the PR body, a Verified / Not verified block (Not verified must include anything you could not read). Stop at 30% context with a PARTIAL marker.

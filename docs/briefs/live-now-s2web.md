# BRIEF: live-now slice 2, Website half (expose the public `version`)

Lane: CAREFUL (public route data path). Builder: Opus, one worker, branch claude/live-now-s2web. Source: plans/BRIEF-live-now-r1.md "Slice 2" (Website half) and docs/design/live-now-lag/PLAN.md. Slice 1 (#1267, 61c970668) is merged. Admin migration 20270312410000_live_now_state_change_version_v1 is APPLIED on prod (ledger confirmed) and merged as admin #1176 (76dd8ccf2). It adds a top-level `version` to the event_view_p5 payload.

## Problem (verified on main 61c970668)
- `src/modules/event-page/useEventPageQuery.ts:136` `parseEventPageSnapshot` builds a typed object and DROPS any field it does not name. `version` is never read, so the event page `.data` twin (app/routes/event.tsx loader, which dehydrates this snapshot) carries no version.
- Slice 3 (Done screen "Live now") needs that version on the public `/event/<slug>.data`. Without it slice 3 cannot be built.

## Build
1. Add `version` to `EventPageSnapshot`, read from `payload.version`. Absent or null -> null (back-compat with a pre-#1176 RPC). Malformed -> null, never throws, never blocks the page. Exact type: whatever event_view_p5 returns (read it live first; read-only Supabase select of the function body or one live call on a known public event, counts/shape only).
2. Confirm the `.data` loader output includes `version` (add a test on the dehydrated/JSON shape, not only the parser).
3. Contract check: add one `scripts/check-*.mjs` contract pinning that event_view_p5 returns a `version` key. Follow the six rules in `scripts/check-script-conventions.mjs` and docs/ci-guard-notes.md. Add its step to db-contract-check.yml (count it, do not pin the number in prose).
4. Tests: table-driven, shared mapping. Cases: version number present; absent; null; malformed string/object; the snapshot otherwise unchanged. RED FIRST: run the new test against unfixed main and show it fails.
5. No visible change. No Done-screen code. No change to app/routes/api.revalidate.tsx or cloudflarePurge.ts (slice 1, done).

## Stop rules
- If the live event_view_p5 does NOT return `version` on prod: stop, write PARTIAL with the observed keys, do not invent a field.
- Do not write to prod. Supabase read-only.

## Definition of done
Shape survey (counts only, one live call); every CI job step run locally (read .github/workflows); PR body with a "Verified on real data" block and an honest "Not verified"; PR checks green except inherited red (contract-check on main, seo-preview expected red). Context cap 30%; push early; handover file under docs/handovers or plans. Commit trailer: Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>. PR body ends with: Generated with Claude Code.

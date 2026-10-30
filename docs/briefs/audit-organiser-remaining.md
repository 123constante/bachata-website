# Brief: read-only audit, what is LEFT of the organiser rebuild (P3), Website

Branch: `claude/audit-organiser-remaining` (create from main). Read-only: push ONE file `docs/scoping/organiser-remaining.md`. No src edits, no prod writes (Supabase connector SELECT only, counts only). Marker `[worker-done audit-organiser-remaining]`.

Owner's words 2026-10-30: "Finish working on the organiser rebuild." organiserP3 is being switched on in production now. Your job is the exact list of what is NOT yet built or wired, so builders can be briefed without guessing.

Read first: `docs/organiser-rebuild/p3/CONTRACT.md`, `docs/design/p3-w4a.md`, `docs/design/p3-w4b-onboarding.md`, `docs/plans/onboarding-arc.md` (Appendix A and the S1-S7 queue), `docs/handovers/p3-w4b2-page.md`, `docs/scoping/go-live-flags-checklist.md`, `docs/scoping/p3-w4c-going.md` (on branch `claude/scope-p3-w4c`), and every `docs/handover*/p3-*`.

## Answer these, each with file:line evidence
1. Every old-area route in `src/modules/organiser/OrganiserRoutes.tsx` (team, switch, page and profile, cover, more, help, onboarding, golive, create wizard, account settings, invites and claims): is there a P3 replacement mounted behind `organiserP3`? Table: old route | P3 route or NONE | state (built, partial, missing).
2. Go-live: the step that puts a new organiser's page live. Does a P3 screen exist, is it wired into onboarding, what RPC does it call and does that RPC exist live on prod (pg_proc read)?
3. Onboarding arc S1-S7: which have merged, which are open, which are not started. Name each remaining slice with model, lane, files, and what it depends on.
4. Which remaining slices can run in parallel on disjoint files, and which must be serial.
5. Anything a signed-in organiser can still reach that dead-ends, loops, or shows copy pointing at a missing control once organiserP3 is ON (walk the routing tables in tests, do not guess).
6. For each remaining slice: the one-paragraph brief a builder needs (goal, files owned, tests, the real shapes to cover).

Verdict format: ordered table of remaining slices, then Verified / Not verified. Read, do not build.

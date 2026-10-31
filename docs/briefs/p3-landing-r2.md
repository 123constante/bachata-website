# Brief: p3-landing-r2 (continuation on claude/p3-landing, CAREFUL lane, Opus). PR #1237 exists.

Read first: the handover on the branch (docs/design/p3-acceptance/p3-landing-HANDOVER.md) and the original brief (git show origin/brief/p3-landing:docs/briefs/p3-landing.md). Do ONLY what is left:

1. BUNDLE BUDGET (blocker). Run `npm run build && npm run check:bundle-budget` on main and on the branch. The PR must add 0 bytes to dancer-app first load. Apply the handover's fix: organiserAreaHome reads the two Vite env flags (P3 and SELF_SERVE) itself, with no eager featureFlags import, and a test pins it equal to `flags`; switch the matrix test to vi.stubEnv. If bytes remain, move shared logic behind the existing lazy chunk boundary, or pass booleans from callers that already hold flags. NEVER edit the perf budget file or the Vite config.
2. Add a component test that MOUNTS OrganiserRoutes and proves: /account/o/events/:id goes to /account/p3/events/:id; ?legacy=1 stays in the old area and persists per tab; the signed-out redirect runs before AuthGuard; flag OFF means no redirect. Add ONE e2e at 390x844 with the P3 flags on, added by NAME to the test:e2e:p3 script. scripts/check-p3-specs-not-skipped.mjs must stay green.
3. Confirm handover item 2 (keep the organiserCount === 0 guard) is consistent with the table. Put handover item 3 in the PR body as a DECISION for the lead: an unfinished dancer at /account/o with the flag on now reaches P3 Welcome, not /finish-profile; say what happens to such a person end to end.
4. Run every CI job step that applies (read .github/workflows), the lint chain and `npm run pre-ship`. Compare the 5 failing contract/env suites against main (same failures on main = inherited; say so). Fill the PR body (Verified / Not verified, per-job table). Do NOT flip the flag.

Stopping rule: one build round. Push once. Commit subject ends [worker-done <ticket>].

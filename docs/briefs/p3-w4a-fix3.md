# Brief: P3 W4a fix 3 (Website, normal lane, Opus builder)

Branch `claude/p3-w4a-fix3` from current `main` (W4a #1080 is merged as 8b171b4; flag `organiserP3` is OFF in prod). Context cap 30%: push early. Source of truth: the independent review `docs/review/pr-1080-r1.md` on branch `claude/review-1080-r1` (fetch it, read the whole findings table and section 1 on the live RPC rules). Write tests RED first against the unfixed code and say so.

Owner rule: the UI never offers what the RPC refuses; empty states say what the person CAN do; disabled controls say why; no copy points at a missing control. The 2026-10-08 incident was exactly these classes. Fix the CLASS with one shared mapping, not per-screen patches.

Fix F1-F4, F6-F8 and nits F9-F11; F12 is a note.
- **F1** Decline is offered to Managers but `resolve_organiser_access_request_v1` is owner-only: hide or disable Decline (with the reason and a Message us path) when `viewerRole !== 'owner'` (`JoinRequest.tsx:64-65`, `team/index.tsx:66-70`).
- **F2** 39 of 51 prod pages have exactly one manager and NO owner. Add the "sole manager, no owner" row to `you.matrix.test.tsx` (and any team matrix) for every owner-only action (Make Manager, Remove, Hand over, Decline); the reasons must not name an owner that does not exist and must offer a path (Message us).
- **F3** The sole member of an ownerless page can Leave and orphan it: disable Leave with a reason when `members.length === 1` and no owner (`team/index.tsx:92-93`, `Person.tsx:97-98`). Note in the PR that the server guard belongs to the admin repo (do not touch it).
- **F4** Remove/Leave for a Contributor fails at the RPC (`Person.tsx:66` `canRemove`): make the UI offer only what `remove_organiser_member_v1` accepts; the contributor matrix rows must reflect the REAL RPC, not the mocks.
- **F5** Decision made: when `flags.organiserP3` and `flags.organiserSelfServe` are both on, the post-accept landing goes to the P3 Welcome (`/account/p3/you/welcome?o=`), else R1's. Keep R1 untouched with the flags off.
- **F6** One shared no-page copy (with the Message us link) for You, P3 Team and the P3 page editor at 0 pages (`youRows.ts:38,66,70`, `team/index.tsx:62`, `page/index.tsx:55`).
- **F7** Late result after navigating away yanks the user to Done (`Person.tsx`, `Confirm.tsx`, `AddSomeone.tsx`): guard with a mounted ref or move the navigate into `mutate()` callbacks; test with a slow mutation and unmount.
- **F8** Add `already_member` and the `permission_denied: lookup_cap` shape to `TEAM_COPY` (`selfServeErrors.ts`).
- **F9-F11** rename the misleading `team-full` hook (keep tests green), Welcome's "Your pages are on You." wording, and give the pushed-screen Suspense fallback the top bar (`p3/you/surface.tsx:68-70`).

Standing header lines:
- Prove the data source first: re-read the RPC bodies read-only on prod (project stsdtacfauprzrdebmzg, counts only, never a write) for every rule you encode; state table/column and who writes it.
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and the branch (main 373.6 KB of 374 KB); never edit `perf-budgets.json` or `vite.config.ts`; keep the You/Team/Switch screens lazy.
- Overlay geometry: portalled sheets and toasts must not scroll the page; an e2e at 390x844 asserts boxes inside the viewport.
- Stopping rule: one independent review will follow, one fix round, then the orchestrator walk.
- Append-only edits in shared P3 files; `youTickets.tsx` stays the one W-T merge point; do not touch another session's branches.
Run every CI job step in your sandbox, per-job table in the PR body with the `## Verified on real data` section (Shapes surveyed / Checks run / NOT verified, one line each). Final commit subject ends `[worker-done dt_<ticket>]`.

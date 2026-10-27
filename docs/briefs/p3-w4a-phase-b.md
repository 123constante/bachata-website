# Brief: P3 W4a Team, Switch organiser, Organiser page, PHASE B (build), Website, normal lane

Repo 123constante/bachata-website. Continue on branch `claude/p3-w4a-team-switch-page` (Phase A pushed: PR #1080, `docs/design/p3-w4a.md`, `mockups/p3-w4a/`). First merge/rebase fresh `origin/main` (the team picker #737 and others landed on these screens); re-read the three areas for changes since Phase A. Read the Phase A design record + handover and the original brief `docs/briefs/p3-w4a-team-switch-page.md` on `brief/p3-w4a-team-switch-page`.

## Owner picks (clicks 2026-10-27, final)
- **Mockup A, You hub**: the P3 You tab becomes a hub: page card + rows (Switch page [only with 2+ pages], Organiser page, Team, Account) that push the screens; back returns to You. Build exactly `mockups/p3-w4a/A.html`.
- A Contributor sees Team's "Add someone" DISABLED with the reason "Only an owner or a manager adds people." (today it is hidden).
- Welcome 7c wording becomes "Switch any time from You".
- P3 tokens only; no second theme file. The event flyer (`cover/:seriesId`) goes to the event page under Events (W2a), not You; if W2a already has it, leave it; if not, list it in the handover rather than building it.

## Build
1. Prod shape survey (Supabase MCP read-only, project stsdtacfauprzrdebmzg, counts only): pages per login, team sizes, role mix owner/manager/contributor, incoming join requests, pages with no profile/photo/about. Table in the PR body.
2. Re-skin only: reuse hooks, models, RPC wrappers, error strings and existing tests (`team/`, `switch/`, `page/`). New P3 routes/screens under `src/modules/organiser/p3/`, behind `organiserP3`. Old R1 routes unchanged while the flag is off.
3. Parallel work: the W-T ticketing worker adds a Get paid row to You. Keep the You hub's row list in ONE small data-driven file so a Get paid row drops in without a conflict; note it in the PR.
4. Table-driven consistency matrix screen x shape (single vs multi page, owner/manager/contributor, empty team, team of 12, full 20, long names, no page vs draft vs published, join request incl. blocked-when-full, no dancer profile, loading, error, remove confirm, not-on-team). One shared mapping per repeated fact. Untouched save sends nothing.
5. Every CI job step that applies; per-job table in the PR body. Leave the PR a draft; walk, critique and Verified block are the orchestrator's, list what you did not check.

## Do not
Touch Supabase/migrations, the public `OrganiserProfile.tsx`, or the density-exempt calendar files.

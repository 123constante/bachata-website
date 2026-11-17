# Brief: organiser slice 1, nav + technical fixes (one branch, one PR, flag-gated)

Read first: ~/.claude/plans/LIVE-organiser-finish.md, ~/.claude/plans/HANDOVER-organiser-arc-2026-11-17d-to-c4.md, DESIGN-REGISTRY.md organiser rows.
Base: origin/main. V2 shell is `src/modules/organiser/p3/v2/*` behind `organiserShellV2` (needs organiserP3 + organiserDash). Everything stays behind those flags; OFF = unchanged.

Do (V2 shell only):
1. Owner click: "Switch page" link + to-do badge back on EVERY tab (Tickets, Guest list, Raffle, and Home/Events). Same look as before the P3RoleStrip was dropped.
2. Back link: use router navigation, not plain `<a href="/">` (no full reload).
3. Pushed screens (New event, Team): do not show V2 top bar + tabs on top of their own Back; one Back only.
4. Tab links keep only `?e=` and `?o=`, not the whole search string.
5. Replace hard-coded "Home" links in GetPaid, OnboardingFlow and the `*` fallback with the V2 home route when V2 is on.
6. Switcher shows more than names where data exists (role/event count); define or remove class `v2-switch-empty`.
7. `nightsOfChoice` must include draft/undated nights so a draft series with dates does not say "has no coming dates" on Guest list and Raffle.
8. Bundle budget: V2Shell/V2Tabs are statically imported in P3Routes; try again to keep them out of the dancer-app first load (lazy only the V2 parts that fit; if no fix, say so, do not raise the budget).

Rules: do NOT touch `p3/tickets/*` or `p3/door/*`. Source files over 2 KB via scripts/safe-edit.py. Round-4c look, tap targets >=44px explicit px, HTML entities not raw punctuation. Consistency matrix test for each screen x shape. 390x844 walk on prod-shaped data (laptop-walk.mjs), fixes in same PR. Include the "Verified on real data" block with honest Not verified. No money. Do not merge.
Finish: push, PR body filled, end last commit subject with your [worker-done <ticket>] marker. In the PR body say which flags to set for a Vercel preview (organiserShellV2, organiserP3, organiserDash) so the owner gets one link.

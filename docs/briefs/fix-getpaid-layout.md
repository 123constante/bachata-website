# Fix: P3 Get paid screen layout (Website, normal lane, Sonnet) - ticket fix-getpaid-layout

Repo 123constante/bachata-website. Branch claude/p3-getpaid-layout. End your last commit message with `[worker-done fix-getpaid-layout]`.

## Owner-visible failure
At `/account/p3/you/get-paid` at 390x844 the cream card ("Paid out via Stripe / Payments connected") sits FLUSH to the left and right screen edges (no side margin), the back-to-You link touches the left edge, and the bottom tab bar sits directly under the card with a large empty cream area below it. Same on main (not a regression of #1165). Other P3 screens (Home, You) have the normal side margin and the tab bar at the bottom.

## Do
1. Find the screen (src/modules/organiser/p3/tickets/GetPaid*, mounted by shell/youTickets.tsx as youGetPaidRoute) and why it lacks the shell's page padding and bottom-pinned tab bar that the other P3 screens get. Fix by using the same shell wrapper/tokens as the other P3 screens (one shared mapping, no new CSS values; read p3/theme/p3.css and DESIGN.md).
2. Tap targets stay at least 44px in px, not rem (html font-size is about 13.5px on phones). No sideways scroll.
3. Test: a render test that the Get paid screen sits inside the same wrapper as the You screen (red first on the unfixed code).
4. Walk yourself if you can; otherwise state it was not walked. Zero bytes to the /app first load: run `npm run check:bundle-budget` on main and on the branch; never edit perf-budgets.json or vite.config.ts.
5. PR body needs the plain lines `- Shapes surveyed: ...`, `- Checks run: ...`, `- NOT verified: ...` and a `## Phone QA` section (Sizes checked / Walked / Not verified). Stopping rule: one independent review, one fix round, then the orchestrator walk.

Read-only on prod. Add docs/design/<pr>.md if the PR number is known, else say it was skipped.

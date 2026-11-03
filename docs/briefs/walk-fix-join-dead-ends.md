# Brief: walk-fix-join-dead-ends (WEBSITE, NORMAL lane, Sonnet). Walk the changed join screens at 390x844. Branch claude/walk-fix-join-dead-ends

Context: stay under 50% of your context; push ONCE, then stop. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. Do not add run-ci. British English. This is a WALK REPORT: no product code changes, no PR needed (the bot may open one; that is fine, it gets closed). Do NOT edit anything under src/.

Goal: take real screenshots of the screens changed by PR #1301 (branch claude/fix-join-dead-ends-r1, head 70edc6b) at 390x844 so the orchestrator can look at them.

STEPS
1. `git fetch origin claude/fix-join-dead-ends-r1 claude/walk-invite-first-minute main`; create your branch claude/walk-fix-join-dead-ends from claude/fix-join-dead-ends-r1.
2. Read the unit tests `src/modules/admin-organisers/join/__tests__/deadEnds.table.test.tsx` for the exact states and the mock setup (route-mocked, no real network). Reuse the earlier walk for harness ideas: `git show origin/claude/walk-invite-first-minute:docs/walk/invite-first-minute/RESULTS.md` and `.../on/texts.jsonl` (exact words and controls per screen).
3. Write ONE Playwright spec `tests/e2e/walk-fix-join-dead-ends.spec.ts` (not added to the test:e2e list) with route mocks, viewport 390x844, that visits: (a) unknown invite link ("This link does not work"): must show the "Ask for a new link" button; (b) used link, signed out (row 07): "Sign in" button present; (c) expired link; (d) the Join card (row 16): new wording "Join X's team. You'll finish a few details about you and the page, then you can add and edit events." For each: full-page screenshot into docs/walk/fix-join-dead-ends-r1/ (named 01-unknown.png, 02-used-signed-out.png, 03-expired.png, 04-join-card.png) and append the visible text and every control's text and bounding-box height to docs/walk/fix-join-dead-ends-r1/texts.jsonl.
4. Check on each screen: no sideways scroll (scrollWidth <= 390), every button at least 44 px tall, no text pointing at a missing control, one clear action per dead end. Write RESULTS.md next to the pictures: one row per screen with PASS / FAIL and the measurements. Use the playwright browser installed locally; if none is available say so and stop (do not fake pictures).
5. Do NOT claim a real phone or real invite was tested.

Deliverable: one push of branch claude/walk-fix-join-dead-ends; final commit subject ends [worker-done <ticket>].

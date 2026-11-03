# Brief: fix-join-dead-ends-r1 (WEBSITE, NORMAL lane, Sonnet). Four small wording and dead-end fixes on the invite/join screens. Branch claude/fix-join-dead-ends-r1

Context: stay under 50% of your context; push ONCE when coherent, then the handover. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. Do not add run-ci. No new rule, no server change, no migration, no flag change. British English. Use HTML entities (&mdash; &rsquo;) in JSX, never raw Unicode punctuation. Source files over 2 KB: use scripts/safe-edit.py (surgical) or scripts/safe-write.py (new file), as CLAUDE.md says.

BASE CHECK FIRST: `git fetch origin main`; the branch must be cut from current origin/main (`git merge-base HEAD origin/main` equals origin/main) before the first push.

Owner decision 2026-11-03: the onboarding rule stays at all 10 items before the first event edit (gate unchanged). Only the four fixes below.

Source of truth for the problem: branch `claude/walk-invite-first-minute`, `docs/walk/invite-first-minute/RESULTS.md` (rows 07, 08, 12, 16, 17) and `on/texts.jsonl` (exact words and controls per screen). Fetch with `git fetch origin claude/walk-invite-first-minute` then `git show FETCH_HEAD:docs/walk/invite-first-minute/RESULTS.md`.

STEP 1 (inventory, before editing): list every state of the invite/join screens (file:line) that shows words for rows 07, 08, 12 and 16, and which controls each has. End with a coverage count (N states, N handled, none omitted).

THE FOUR FIXES
1. Row 07 "This link was already used" (signed out): add a primary button "Sign in" that goes to the existing sign-in route and returns the person to where they were headed (reuse the existing returnTo mechanism; invent no new route). Keep the words "If that was not you, ask for a new one."
2. Row 08 "This link does not work": add a button "Ask for a new link" that does what the expired screen's button does when the inviter is unknown, or if there is no such path, a link to the existing contact/WhatsApp route the site already uses on the sign-up wall. Do not invent a new endpoint. If neither exists, say so in the handover and leave the sentence only.
3. Row 12 wrong vs expired code: two different messages. Wrong: "That code does not match. Check the email and try again." Expired: "That code has run out. Get a new one." with the resend control focused. Only do this if the server answer already distinguishes the two (read the client code that maps the error). If it does not, STOP on this item, change nothing, and say so.
4. Row 16 Join card promise: replace "You'll be able to add and edit the events of X and manage its page." with words that match the gate: "Join X's team. You'll finish a few details about you and the page, then you can add and edit events." Same one screen, no new control.

RULES: red-first, table-driven: one test matrix over the states of rows 07, 08, 12, 16 (each state x each control present, no copy pointing at a missing control, every dead end has one action). Run it on the unfixed code first and show it red, then green. One shared words mapping, no duplicate strings. `npm run check:bundle-budget` on main and on the branch must show 0 bytes added to dancer-app first load (put the join code in its existing chunk). Never edit perf-budgets.json or vite.config.ts. Walk the four screens at 390x844 with a route-mocked e2e (tests/e2e, not in test:e2e unless you add it by name) and put the pictures in docs/walk/fix-join-dead-ends-r1/. Every tap target at least 44 px (explicit px; the site's html font-size is about 13.5px on phones).

PR body: when the PR exists, put under `## Phone QA` exactly `- Sizes checked:`, `- Walked:`, `- Not verified:` and the label `- Shapes surveyed:` under `## Verified on real data`. Say what was NOT verified (real phone, real invite).

Deliverable: one push; handover docs/handovers/fix-join-dead-ends-r1.md with Verified / Not verified, red-first evidence and bundle numbers. Final commit subject ends [worker-done <ticket>].

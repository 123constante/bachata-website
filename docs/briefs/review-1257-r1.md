# Brief: review-1257-r1 (WEBSITE, READ-ONLY REVIEW, Opus; builder was Sonnet). Branch claude/review-1257-r1 -> docs/review/pr-1257-r1.md only.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY.

Review PR #1257 (branch claude/fix-join-outcomes-r1, head 463d588; handover docs/handover/fix-join-outcomes-r1.md on that branch). Diff of CODE only: `git diff origin/main...origin/claude/fix-join-outcomes-r1 -- src docs/handover/fix-join-outcomes-r1.md` (ignore the unrelated png files; say if they are really in the PR diff against main).
Risk: invite join path (owner priority: easy, no dead ends). Find CORRECTNESS bugs only, with file:line and a failing input:
1. redeemAction(): every redeem outcome (done, email_mismatch, email_unproven, not_linked, invalid/expired/used token, network error, unknown) maps to one screen; "told" copy ONLY for not_linked; no outcome falls to a dead end or a misleading message.
2. Post-sign-in branch in JoinPage.tsx (person-bound invite): the old code showed not_linked for any non-done outcome; confirm every other outcome now shows the right screen. Double-tap, sign-in return with stale state.
3. "Send my code" never dead: empty, bad-shape, valid email; copy never points at a missing control.
4. Do the new tests really fail on main's source (mutate redeemAction to the old behaviour and confirm red)? Any vacuous assertion?
5. Server rules to compare with (read prod RPC redeem_organiser_invite_v1, read-only): email_mismatch, email_unproven, not_linked.
Deliverable docs/review/pr-1257-r1.md: verdict PASS / PASS WITH NITS / BLOCK, findings ranked with file:line, failing scenario, suggested fix; honest Verified / Not verified (run `npx vitest run src/modules/admin-organisers/join` and report counts). Commit subject ends [worker-done <ticket>].

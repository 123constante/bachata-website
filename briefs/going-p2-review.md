# Brief: independent CODE review of Going P2 (PR #992). Review only, no fixes.

Model: Opus. You did NOT build this. Branch `claude/going-p2-review` already exists at the PR head `0051c372` (do not branch from main). Your only output is one file, `docs/reviews/going-p2-review.md`, committed and pushed to `claude/going-p2-review`. Do NOT edit code. Do NOT push to `claude/going-p2-website`.

Read first: the brief `git show origin/brief/going-p2-website:briefs/going-p2-website.md`; the builder handover `docs/handovers/going-p2-website.md`; the critique `docs/design/going-p2-critique.md` + `docs/handovers/going-p2-critique.md`; the database interface in the brief ("The database interface"). Diff: `git diff origin/main...HEAD`.

## Review for (most important first)
1. **Switch OFF on production = nothing Going-related changes for visitors.** Prove it from the code: every surface, the calendar fetch (no going request while off), the settings switch hidden and never sent, the build-time fold of `GOING_CHECKIN_ENABLED` (vite `define`, `VERCEL_ENV`). Could a production build ever turn it on?
2. **Privacy.** No account/auth id ever rendered, logged or sent to analytics; a person is linked only when `dancer_profile_id` is non-null; photo only when `photo_url` is set; no Interested anywhere.
3. **Correctness of the one mapping** (`src/modules/going/goingState.ts`, `goingCopy.ts`): every refusal code (not_signed_in, anonymous_session, invalid_argument, not_found, event_not_live, night_cancelled, night_ended, profile_incomplete, rate_limited, too_many_ids, 42501 permission denied) -> a state with words and a way on; optimistic update + rollback in `useNightGoing`; query keys invalidated after a save; batching/chunking at 200 ids; `starts_at_local` never passed to `new Date()`.
4. **Regressions from deletions**: every removed caller of the old RPCs (`set_attendance`, `set_my_occurrence_attendance_p5_v1`, `get_my_event_attendance_v1/v2`, `get_festival_attendance*`, `get_event_attendance_counts*`) and the removed UI (festival WhatsApp progress bar, "Your plans", DancerDashboard parts) -- does anything visible to visitors change while the switch is OFF? List each visible change with file:line; the owner must know.
5. **Guards**: `scripts/check-going-legacy-rpcs.mjs` and `scripts/check-going-rpcs.mjs` -- can each still fail (canary real)? Do they follow `docs/ci-guard-notes.md` / `check-script-conventions.mjs`? Mutate one call site back to an old RPC in your head (or in a scratch copy) and say whether the guard catches it.
6. **Tests**: table-driven over goingState x surface x shape as the brief asked? Any test that passes for the wrong reason (mock returns what the assertion wants)?
7. Calendar files (`EventCalendar.tsx`, `CalendarListView.tsx`) are density-excluded: confirm the diff there is ONLY the going count/feed and the chip colour.

## Output format (`docs/reviews/going-p2-review.md`)
Verdict line: SHIP / SHIP-WITH-FIXES / DO-NOT-SHIP. Then a table: # | severity (blocker / should / nice) | file:line | finding | concrete failure scenario | suggested fix. Then "Checked and fine" (short list). Plain words: the owner is a beginner. Nothing else.

Finish: commit with subject ending `[worker-done <ticket>]` and push `claude/going-p2-review` once. Run nothing that needs secrets; `npm ci`, `npx vitest run <files>`, `npm run typecheck` are fine if you need proof.

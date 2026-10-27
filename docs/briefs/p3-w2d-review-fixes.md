# Brief: P3 W2d fix round 1 -- findings from the independent review of PR #1068

Lane: normal. Repo 123constante/bachata-website. Branch `claude/p3-w2d-sessions-lineup` (PR #1068, head c60588e). Continue ON this branch. The review is `docs/reviews/1068-r1.md` on branch `claude/review-1068-r1` (`git fetch origin claude/review-1068-r1`, then `git show origin/claude/review-1068-r1:docs/reviews/1068-r1.md`). Owner chose: fix #1, #2, #3 and the cheap nits.

## Fix (red test first for each, then the fix)
1. Finding 1 (SessionSheet loses typed edits when the date programme refetches): `baseKey` must not include `prog.dataUpdatedAt`; key the edit state on the stored content (version / ids), so a background refetch with unchanged data keeps the person's typing, and a refetch that brings a NEW version after a save resets it. Test: type, refetch same data, fields keep the text; refetch new version, fields reset.
2. Finding 2 (nameless NEW session): require a name for a NEW session in BOTH scopes (Every date and Just this date), same sentence ("Give this session a name."), keep the #25 leniency for STORED untitled items only. "Add this session" is disabled on an empty form with the reason shown. Test the matrix: new/stored x titled/untitled x scope.
3. Finding 3 (idempotency key vs version): read the server envelope handling read-only (Supabase SELECT of the function body that stores/replays the idempotency key for `series_command_p5`). If a key re-sent with a NEW `expected_version` is replayed with the OLD result or rejected, mint a fresh key whenever the version changes or after a definitive refusal; keep the same key for a pure retry (same envelope). State what you found and add a test either way.
4. Nits 4 to 7: disable the line-up search result for a stored person who is taken off, with "Use Put back"; add the one-line explanation for performance sessions ("Performers and the MC are added by the Bachata Calendar team", reuse `whyCannotAddPerson` text, no second copy); use `CHANGED_SESSION_REMOVE_CONFIRM` in the remove-from-every-date confirm and never render "all 0 dates"; keep unsaved edits when switching scope, or say plainly that switching resets them (pick the simpler, test it).
5. Finding 8 (misleading refusal copy for the series caps): add the three cap refusals (`holds at most 60 sessions`, `a session holds at most 20 people`, `300 line-up entries`) to `COMMAND_COPY` with plain words that say what to remove, anchored before the loose set_program rule, with the spec-friendly trailing pattern (`( |$)`), and check `tests/e2e-phone/organiser-refusal-copy.phone.spec.ts` stays green.

## Checks
Run the changed vitest files, `npx tsc --noEmit`, `npm run lint`, the refusal-copy phone spec, and the W2d walk (`docs/handover/p3-w2d-sessions/walk.phone.spec.ts.txt` style) at 390x844 light and dark if any screen changed; refresh ONLY the PNGs for screens you changed under `docs/handover/p3-w2d-sessions/` and confirm `git diff --name-only origin/main...HEAD` shows only W2d files. Update `docs/design/1068.md` with a "Review round 1" table (finding, fixed / not, why). Update the PR body "Checks run" line if it changes. Push ONCE.

## Do NOT
Touch other PRs or files outside W2d, weaken a test, merge, or `--no-verify`. The full phone suite needs 13+ minutes: run only the specs relevant to your change plus the refusal-copy spec.

## Done =
Final commit subject ends with the done marker. Stop at 50% context with a PARTIAL marker.

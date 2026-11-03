# Brief: door-code-fix-r2 (WEBSITE repo 123constante/bachata-website, Sonnet, NORMAL lane). Continue branch claude/ticket-door-code-screen (PR #1294, flag ticketDoorCode stays OFF). ONE push.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. Base check: `git fetch origin main claude/ticket-door-code-screen`; merge origin/main if it moved (say so).

## Source of truth
Independent review: branch origin/claude/review-1294-r1, file docs/reviews/1294-r1.md (verdict FIX). Read it first. Fix exactly F3-F7; F1 (PR body) and F2 (contract-check, unrelated) are the orchestrator's.

## Task
0. Red first: for F3 and F4 write the failing matrix/unit case BEFORE the fix; run it, show it red, then fix.
1. F3 (medium): after a list Check in answers not_allowed, the row buttons must be hidden or aria-disabled with the card's reason, as the scan tab already does with `notAllowed` (DoorScreen.tsx ~198, ListTab ~338-391). Pass `notAllowed` to ListTab.
2. F4: invalidate the list on `already_in` from the list too (DoorScreen.tsx ~92).
3. F5: when the list could not load (`list.isError && !list.data`) the paused banner must not say "tap Check in" (drop it or reword "when the list loads").
4. F6: rename role `editor` -> `manager` in the matrix ROLES and in the INVENTORY/handover docs (prod roles are owner, manager, contributor; contributors ARE allowed).
5. F7: correct the handover claim to the measured red-first numbers (168 failed / 50 passed of 218) and say the two flag-off differences plainly; do not change behaviour for them.
6. Run: the door suite (`npx vitest run src/modules/organiser/p3/door`), the e2e door spec as the repo runs it, `npm run lint`, typecheck, bundle-budget check if the repo has a script (flag OFF bundle must stay 0 bytes of door code). Report the per-job table.

Handover docs/handover/door-code-fix-r2.md: Done / Not verified. Commit subject ends [worker-done <ticket>].

# ER-REVIEW-W1 (read-only review): wave 1 = C2 + C3 + C4 + C5

Branch to review: `claude/er-wave1` (merge of `claude/er-ui-ember` ER-C2, `claude/er-s1-rules` ER-C3, `claude/er-c4-sessions` ER-C4, `claude/er-c5-venue` ER-C5). Base for the diff: `b0983348` (main when the slices started). You are the INDEPENDENT reviewer (Opus, xhigh): you did not write any of it. Read ER-COMMON.md, ER-INTERFACE.md (its AS BUILT section wins), the plan Rule sheet 1-29 and the slice handovers `docs/organiser-rebuild/er/handover/ER-C2..C5.md` on that branch.

## Output (the ONLY thing you push)
Branch `claude/review-er-wave1`, one file `docs/organiser-rebuild/er/review/ER-W1.md`, ONE push, last commit subject ending `[worker-done <ticket>]`. No source edits. Structure: per finding `SEVERITY (blocker|major|minor) | slice | file:line | what is wrong | exact failure (input -> wrong output) | proposed fix`. Then a short "Verified / Not verified". Fewer, proven findings beat many guesses: a finding without a concrete failing input is a minor note at most.

## What to check (each is a known risk, not a hint to rubber-stamp)
1. C5 vs the server AS BUILT (ER-INTERFACE.md): argument names and result shapes of `owner_create_venue_draft_v1` (`{venue_id, existing}`) and `owner_similar_venues_v1` (`{venues:[{venue_id,name,postcode}]}`), error mapping (`rate_limited` = the 5 a day limit), `p_area` goes to neighbourhood. Would the picker work against the real function?
2. C3 rules vs the plan Rule sheet: is every rule that C3 encodes (`event-rules.json`, `shared/eventRules.ts`) the same as the plan text? Any rule C3 changed or invented. The mirror check with admin (path of the admin copy) is a parked question: say whether it can be satisfied.
3. C3 touched files outside its card (`flows/add/Time.tsx`, `WhichDay.tsx`, `notFoundText.ts`): is each change safe and covered?
4. C4: the model against the shapes in its handover (wraps past midnight, off-grid stored times, level only on class and masterclass, room list-wide). Are there session shapes that cannot be loaded, edited and saved back unchanged (rule: saving an untouched record sends nothing)? The 220 untimed parties and 134 level-less classes block Done: is "blocks with a reason" really what the plan rules say, or must loading pre-fill?
5. C2: the Ember scope. Does ANY default (non-ember) screen change? Check the contrast of the warn strip and accent on ink; the 44px Chip hit area; no `rem` tap sizes.
6. Tests that cannot fail: pick the 5 most important new tests across the four slices and mutate the code under test (revert the rule it guards); say which tests stay green.
7. Cross-slice: do the four slices agree on one mapping for session kinds, lengths, levels, payment codes? Any duplicated copy of a rule that C3 already owns.
8. A11y and phone: focus return, Escape, labels on icon buttons, text pointing at a control that is not on screen, empty states that say what the person CAN do.
9. The calendar exclusion-list files and `ui/dialog.tsx` are untouched (diff proof).

## Hard limits
Read-only. Plain git only (`git fetch`, `git show`, `git diff`, `git push`); never `gh api`. No `--no-verify`. You may run vitest, tsc, eslint and `npm run build` in your sandbox to prove a finding; put the commands and exit codes in the file. One push.

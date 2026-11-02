# Brief: 390x844 walk of PR #1274 (join first-name help line) -- tests + pictures only (Sonnet, normal lane)

Branch `claude/walk-join-help-r1`, cut from branch `claude/join-firstname-help` (head 7f61395; fetch it, branch from it). You change NO file under `src/`. You add `tests/e2e/walk-join-firstname-help.spec.ts` and `docs/walk/join-firstname-help/RESULTS.md` plus the screenshots. Pattern to copy: `tests/e2e/walk-join-outcomes.spec.ts` on branch `claude/walk-join-outcomes-r1` (mocked invite RPCs, no prod access, no sign-in).

## What PR #1274 does
`src/modules/admin-organisers/join/AboutStep.tsx` shows under the First name field the help line from `JOIN_COPY.about.firstNameHelp` = "Your own first name, not the page name.", with `aria-describedby="join-first-name-help"` on the input. Fixed text, never the page name.

## Do
1. Walk the About step at 390x844 for {page invite for "Cumbaye", person-bound invite for "Daniel Rivera"} x {first name empty, typed, linked/prefilled}: 6 pictures minimum, each full screen.
2. Measured per picture: the help line is visible and not clipped, no sideways scroll, text contrast >= 4.5:1, the input and Continue tap targets >= 44px, the input's aria-describedby resolves to the help element, the help text never contains the page name or "Maria".
3. Run the join unit tests (`npx vitest run src/modules/admin-organisers/join`) and report the count.
4. RESULTS.md: a table of every picture with the measured numbers, then honest Verified / Not verified (real invite tokens on prod are NOT used; say so).

BASE CHECK: verify `git merge-base HEAD origin/claude/join-firstname-help` equals its head before pushing. Context cap 50%. Last commit subject ends with the done marker from your prompt.

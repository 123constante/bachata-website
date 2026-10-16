# Brief: keyboard-safe Website (every text field stays visible above the phone keyboard)

Repo: 123constante/bachata-website. Work branch: `claude/site-keyboard-safe` (off `main`, head ecc3432e or later).
Model: Opus. One worker, one PR. Stop after the push and the report.

## What the owner saw (their words, 2026-10-16 08:10, Android phone, in-app Chrome tab)
"Its hidden behind the keyboard - can we make sure every part of the website is suitable for when keyboard appears"

Screen: organiser onboarding, "Which organiser are you?" (`src/modules/organiser/home/onboarding/OnboardingView.tsx`).
They typed "Sensu" in the search field. The field sits at the bottom of the visible area and the results list
starts right under it, so every result is hidden behind the keyboard. Nothing scrolled.

The check that would have caught it: a phone-size test that opens the keyboard (shrinks the viewport) after
focusing each text field and asserts the field AND what it controls (results, the next button) are visible and
tappable. That check did not exist; build it, prove it RED on today's main, then make it green.

## Why it matters
Every text field on the site will be used on a phone. A field or its results under the keyboard reads as
"the site is broken". This is a CLASS of bug: fix it once for the whole site, plus a test that covers every field.

## What exists today (measured by the orchestrator)
- `index.html` viewport meta is `width=device-width, initial-scale=1.0` (no `interactive-widget`).
- `src/modules/organiser/ui/useKeyboardInset.ts` already tracks the keyboard through `window.visualViewport`; it is
  used by the organiser edit sheets (`edit-in-place/*Sheet.tsx`, `sheetStyles.ts`, `ui/SheetView.tsx`,
  `ui/PreviewBar.tsx`, `shell/OrganiserShell.tsx`). Nothing outside organiser handles the keyboard.
- About 27 non-test `.tsx` files render `<input>`/`<textarea>`/search fields.
- Phone suite: `playwright.phone.config.ts`, `tests/e2e-phone/*.phone.spec.ts` with `tests/e2e-phone/fakeSupabase.mjs`,
  run by `.github/workflows/phone-qa.yml` (`npx playwright test --config playwright.phone.config.ts`).

## Decisions already made (the orchestrator decided under the owner's rules; do not reopen)
1. Add `interactive-widget=resizes-content` to the viewport meta, so on Android the page itself shrinks when the
   keyboard opens (fixed bottoms and `dvh` move above it).
2. Browsers that ignore it (iOS Safari, some in-app tabs) overlay the keyboard instead. Cover them with ONE shared
   keyboard helper: move `useKeyboardInset` to a shared place (e.g. `src/lib/keyboard/`), keep a re-export at the old
   organiser path so organiser files need no edit, and expose a CSS variable `--keyboard-inset` on `<html>`.
3. ONE site-wide behaviour, mounted once in the app shell: when a text field (input that takes text, textarea,
   `role=combobox`/`searchbox`, contenteditable) gets focus and the keyboard opens, scroll it so the field's top sits
   just under any sticky header, which leaves room for its results below. A field with a results list
   (`aria-controls`/listbox, or a marked results container) must show the field plus at least the first result row.
   Respect `prefers-reduced-motion` (no smooth scroll). Never steal focus, never scroll when the field is already
   fully visible with its results.
4. Fixed bottom bars (bottom nav, sticky action bars, organiser PreviewBar, cookie/consent bars, toasts) must not
   cover a focused field: hide them or lift them above the keyboard while it is open. One shared rule, not one
   per bar.
5. Organiser lane: another session is planning the organiser rebuild. Touch `src/modules/organiser/**` only as
   far as this fix needs (the re-export, and the onboarding search if the global behaviour is not enough there).
   No restructuring, renames or style changes there.

## The task
1. Inventory every text field on the public site, dancer area, organiser area, auth and account screens
   (route, component, does it have a results list, what fixed bars are on that screen). Put the table in the PR body.
2. Write `tests/e2e-phone/keyboard.phone.spec.ts`: table-driven from that inventory (one row per field), at 390x844
   and 360x640. For each row: open the route (fake Supabase with realistic data: an organiser search with 20+
   organisers so results overflow; long names), focus the field, type a few letters, simulate the keyboard in BOTH
   ways: (a) resize the viewport height to about 470 (what `resizes-content` does), (b) keep the viewport and fake a
   shrunken `visualViewport` (height ~470) as iOS does. Assert: field fully inside the visible area; `elementFromPoint`
   at the field's centre is the field (nothing covers it); for a field with results, the first result row is visible
   and `elementFromPoint` at its centre hits it; no fixed bar overlaps the field; no sideways scroll.
3. Run the spec on UNFIXED code first and record which rows fail (the organiser onboarding search must fail).
   Paste that red run (command, exit code, failing rows) in the PR body. A test that cannot fail proves nothing.
4. Build the fix (decisions 1-4). Re-run: all rows green. Add a mutation proof: remove the global behaviour on
   purpose, confirm the spec goes red, restore it.
5. Check a PRODUCTION build (`npm run build`, then the phone suite against the built preview as the config does),
   not only the dev server.

## Gates and rules (every one binds)
- Run EVERY CI job step yourself in your sandbox (read `.github/workflows/*.yml` that a PR to main triggers) and put
  a per-job table (job, command, exit code) in the PR body. GitHub Actions billing fails intermittently ("recent
  account payments have failed / spending limit"): such a red is not a code failure; your table is the fallback.
  Say plainly what your sandbox could not run.
- The PR body needs a `## Phone QA` section, exactly once: `- Sizes checked:`, `- Walked:`, `- Not verified:`
  (a real phone keyboard is "Not verified" for you).
- Read and push with PLAIN git (`git fetch`, `git show`, `git push`). Never `gh api` (it stalls on a permission prompt).
- Write shell commands WITHOUT variables, loops or `$(...)` where a plain command works.
- Open the PR as the bot with `gh pr create` (bot token from the environment). Never merge, never approve,
  never `--no-verify`. Supabase: read-only, no writes anywhere.
- Context: at 25% start nothing new; by 30% push your work plus a handover (done / left / exact next steps) at
  `docs/handovers/site-keyboard-safe.md` on your branch, last commit subject ending `PARTIAL [worker-done <ticket>]`.
- Checkpoint progress in the PR body after each major step.

## Output you end with
PR link; the inventory table; the red-first run and the green run; the mutation proof; the per-job CI table;
what you could not verify.

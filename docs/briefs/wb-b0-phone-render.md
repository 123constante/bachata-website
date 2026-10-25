# Wave B0 follow-up (Website): prove the 25 new refusal messages fit a phone screen

Lane: NORMAL (Website only, NO database change; context cap 50%, nothing new at 45%). Repo `123constante/bachata-website`.
CONTINUATION of PR #1039: push to the EXISTING branch `claude/wb-b0-organiser-hygiene` (do NOT create a new branch or a new PR; the
PR already exists and is bot-authored). Sonnet is enough. Never merge/approve. Supabase connector READ-ONLY.
One slice = one branch = one push (Vercel cap: 78 of 100 builds used in 24 h). Push ONCE.

## Why
PR #1039 added 25 plain-language lines to `COMMAND_COPY` in `src/modules/organiser/shared/selfServeErrors.ts` (the orchestrator's brief
`docs/briefs/wb-b0-organiser-hygiene.md` on branch `brief/wb-b0-hygiene`, handover `docs/briefs/wb-b0-organiser-hygiene-handover.md` on the PR
branch). A table test proves each server refusal maps to its own sentence. NOTHING yet proves those sentences fit on a phone screen in the
real component that shows them. The owner's rule (definition of done) says a visible text change is looked at at 390x844, and our walk path
(a signed-in organiser with faked server answers) is far too heavy for a wording change. This job replaces the walk with a measured automated check.

## Do
1. Find the real component(s) that display an organiser save/command refusal built from `COMMAND_COPY` (trace from `selfServeErrors.ts` exports
   to the JSX: error banner / inline error / sheet). Do not build a new component for the test; render the real one.
2. Add ONE phone-suite spec (follow the pattern of the existing phone-qa specs; read `playwright.phone.config*` and `.github/workflows/phone-qa*.yml`
   first, run it the way CI does) that, for EVERY message in the 25 new `COMMAND_COPY` rows (derive the list from the exported array so a new row is
   covered automatically; keep a count assertion), at BOTH 390x844 and 360x640:
   - renders the real component with that message,
   - asserts no horizontal overflow (scrollWidth <= clientWidth for the container and the page),
   - asserts the message is fully visible (no ellipsis clipping, no overflow hidden cutting text, bounding box inside the viewport),
   - asserts the nearest actionable control (the dismiss or save bar, whichever the screen has) is still inside the viewport and at least 44 px
     tall, and is not covered (elementFromPoint at its centre is the control),
   - asserts the text colour contrast is at least 4.5:1 against its background.
   Red first: prove the spec can fail (temporarily feed one 400-character message, see it red, then remove that probe; say so in the PR).
3. If a message FAILS a check, fix the component's wrapping or the message (shorter, plain words, still says what the person can do next), not the
   test. Keep every change inside `src/modules/organiser/**` and the one spec; do not touch files other open PRs own (`gh pr list --state open`;
   #1032 touches `selfServeErrors.ts` in other regions: merge-tree against its head must stay clean).
4. Run every CI job step relevant to your change in your sandbox (typecheck, unit tests for the changed files, the phone suite, the build-smoke) and
   update the per-job table in the PR body (edit the body with `gh pr edit 1039 --body-file`, keep the `## Verified on real data` section in the
   EXACT single-line form `- Shapes surveyed: ...`, `- Checks run: ...`, `- NOT verified: ...`; the real-data-verified check rejects nested bullets).
   Move "the 390x844 browser walk" in the Phone QA section from not verified to what you measured, with the numbers (message count, widths, any
   fix made).

## Output
Push once to `claude/wb-b0-organiser-hygiene`; last commit subject ends `[worker-done <ticket>]`. Handover note appended to
`docs/briefs/wb-b0-organiser-hygiene-handover.md`: what you measured per width, anything you changed and why, what is still not verified.
